"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Conversation } from "@/lib/conversations";

export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

// Define types for function registry
type ToolFunction = (...args: unknown[]) => Promise<unknown> | unknown;

// Define type for WebRTC messages
interface WebRTCMessage {
  type: string;
  [key: string]: unknown;
}

// Define proper types for window audio contexts
declare global {
  interface Window {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  }
}

/**
 * The return type for the hook, matching Approach A
 * (RefObject<HTMLDivElement | null> for the audioIndicatorRef).
 */
interface UseWebRTCAudioSessionReturn {
  status: string;
  isSessionActive: boolean;
  audioIndicatorRef: React.RefObject<HTMLDivElement | null>;
  startSession: () => Promise<void>;
  stopSession: () => void;
  handleStartStopClick: () => void;
  registerFunction: (name: string, fn: ToolFunction) => void;
  msgs: WebRTCMessage[];
  currentVolume: number;
  conversation: Conversation[];
  sendTextMessage: (text: string) => void;
  micSessions: { id: string; startedAt: string; endedAt: string }[];
}

/**
 * Hook to manage a real-time session with OpenAI's Realtime endpoints.
 */
export default function useWebRTCAudioSession(
  voice: string,
  tools?: Tool[],
  options?: { threadId?: string },
): UseWebRTCAudioSessionReturn {
  // Connection/session states
  const [status, setStatus] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Audio references for local mic
  // Approach A: explicitly typed as HTMLDivElement | null
  const audioIndicatorRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // WebRTC references
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // Keep track of all raw events/messages
  const [msgs, setMsgs] = useState<WebRTCMessage[]>([]);

  // Main conversation state
  const [conversation, setConversation] = useState<Conversation[]>([]);

  // Track completed mic sessions to leave a small marker in the thread
  const [micSessions, setMicSessions] = useState<
    { id: string; startedAt: string; endedAt: string; threadId?: string }[]
  >([]);
  const sessionStartRef = useRef<Date | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  // For function calls (AI "tools")
  const functionRegistry = useRef<Record<string, ToolFunction>>({});

  // Volume analysis (assistant inbound audio)
  const [currentVolume, setCurrentVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);

  /**
   * We track only the ephemeral user message **ID** here.
   * While user is speaking, we update that conversation item by ID.
   */
  const ephemeralUserMessageIdRef = useRef<string | null>(null);

  /**
   * Register a function (tool) so the AI can call it.
   */
  function registerFunction(name: string, fn: ToolFunction) {
    functionRegistry.current[name] = fn;
  }

  /**
   * Configure the data channel on open, sending a session update to the server.
   */
  function configureDataChannel(dataChannel: RTCDataChannel) {
    // Send session update
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        tools: tools || [],
        input_audio_transcription: {
          model: "whisper-1",
        },
      },
    };
    dataChannel.send(JSON.stringify(sessionUpdate));
    console.log("Session update sent:", sessionUpdate);
  }

  /**
   * Return an ephemeral user ID, creating a new ephemeral message in conversation if needed.
   */
  function getOrCreateEphemeralUserId(): string {
    let ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) {
      // Use uuidv4 for a robust unique ID
      ephemeralId = uuidv4();
      ephemeralUserMessageIdRef.current = ephemeralId;

      const newMessage: Conversation = {
        id: ephemeralId as string,
        role: "user",
        text: "",
        timestamp: new Date().toISOString(),
        isFinal: false,
        status: "speaking",
      };

      // Append the ephemeral item to conversation
      setConversation((prev) => [...prev, newMessage]);
    }
    return ephemeralId as string;
  }

  /**
   * Update the ephemeral user message (by ephemeralUserMessageIdRef) with partial changes.
   */
  function updateEphemeralUserMessage(partial: Partial<Conversation>) {
    const ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) return; // no ephemeral user message to update

    setConversation((prev) =>
      prev.map((msg) => {
        if (msg.id === ephemeralId) {
          return { ...msg, ...partial };
        }
        return msg;
      }),
    );
  }

  /**
   * Clear ephemeral user message ID so the next user speech starts fresh.
   */
  function clearEphemeralUserMessage() {
    ephemeralUserMessageIdRef.current = null;
  }

  /**
   * Main data channel message handler: interprets events from the server.
   */
  async function handleDataChannelMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);
      // console.log("Incoming dataChannel message:", msg);

      switch (msg.type) {
        /**
         * User speech started
         */
        case "input_audio_buffer.speech_started": {
          getOrCreateEphemeralUserId();
          updateEphemeralUserMessage({ status: "speaking" });
          break;
        }

        /**
         * User speech stopped
         */
        case "input_audio_buffer.speech_stopped": {
          // optional: you could set "stopped" or just keep "speaking"
          updateEphemeralUserMessage({ status: "speaking" });
          break;
        }

        /**
         * Audio buffer committed => "Processing speech..."
         */
        case "input_audio_buffer.committed": {
          updateEphemeralUserMessage({
            text: "Processing speech...",
            status: "processing",
          });
          break;
        }

        /**
         * Partial user transcription
         */
        case "conversation.item.input_audio_transcription": {
          const partialText =
            msg.transcript ?? msg.text ?? "User is speaking...";
          updateEphemeralUserMessage({
            text: partialText,
            status: "speaking",
            isFinal: false,
          });
          break;
        }

        /**
         * Final user transcription
         */
        case "conversation.item.input_audio_transcription.completed": {
          // console.log("Final user transcription:", msg.transcript);
          updateEphemeralUserMessage({
            text: msg.transcript || "",
            isFinal: true,
            status: "final",
          });
          clearEphemeralUserMessage();
          break;
        }

        /**
         * Streaming AI transcripts (assistant partial)
         */
        case "response.audio_transcript.delta": {
          const newMessage: Conversation = {
            id: uuidv4(), // generate a fresh ID for each assistant partial
            role: "assistant",
            text: msg.delta,
            timestamp: new Date().toISOString(),
            isFinal: false,
          };

          setConversation((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isFinal) {
              // Append to existing assistant partial
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...lastMsg,
                text: lastMsg.text + msg.delta,
              };
              return updated;
            } else {
              // Start a new assistant partial
              return [...prev, newMessage];
            }
          });
          break;
        }

        /**
         * Mark the last assistant message as final
         */
        case "response.audio_transcript.done": {
          setConversation((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            updated[updated.length - 1].isFinal = true;
            return updated;
          });
          break;
        }

        /**
         * AI calls a function (tool)
         */
        case "response.function_call_arguments.done": {
          const fn = functionRegistry.current[msg.name];
          if (fn) {
            const args = JSON.parse(msg.arguments);
            const result = await fn(args);

            // Respond with function output
            const response = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: msg.call_id,
                output: JSON.stringify(result),
              },
            };
            dataChannelRef.current?.send(JSON.stringify(response));

            const responseCreate = {
              type: "response.create",
            };
            dataChannelRef.current?.send(JSON.stringify(responseCreate));
          }
          break;
        }

        default: {
          // console.warn("Unhandled message type:", msg.type);
          break;
        }
      }

      // Always log the raw message
      setMsgs((prevMsgs) => [...prevMsgs, msg as WebRTCMessage]);
      return msg;
    } catch (error) {
      console.error("Error handling data channel message:", error);
    }
  }

  /**
   * Fetch ephemeral token from your Next.js endpoint
   */
  async function getEphemeralToken() {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Failed to get ephemeral token: ${response.status}`);
      }
      const data = await response.json();
      return data.client_secret.value;
    } catch (err) {
      console.error("getEphemeralToken error:", err);
      throw err;
    }
  }

  /**
   * Sets up a local audio visualization for mic input (toggle wave CSS).
   */
  function setupAudioVisualization(stream: MediaStream) {
    const AudioContextCtor =
      window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      console.error('AudioContext not supported in this browser');
      return;
    }
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateIndicator = () => {
      if (!audioContext) return;
      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;

      // Toggle an "active" class if volume is above a threshold
      if (audioIndicatorRef.current) {
        audioIndicatorRef.current.classList.toggle("active", average > 30);
      }
      requestAnimationFrame(updateIndicator);
    };
    updateIndicator();

    audioContextRef.current = audioContext;
  }

  /**
   * Calculate RMS volume from inbound assistant audio
   */
  function getVolume(): number {
    if (!analyserRef.current) return 0;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const float = (dataArray[i] - 128) / 128;
      sum += float * float;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  /**
   * Start a new session:
   */
  async function startSession() {
    try {
      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      } as MediaStreamConstraints);
      audioStreamRef.current = stream;
      setupAudioVisualization(stream);

      setStatus("Fetching ephemeral token...");
      const ephemeralToken = await getEphemeralToken();

      setStatus("Establishing connection...");
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun.cloudflare.com:3478",
          ] },
        ],
      });
      peerConnectionRef.current = pc;

      // Debug logging for ICE and connection state
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
      };
      pc.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", pc.iceGatheringState);
      };
      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          console.log("ICE candidate:", evt.candidate.type, evt.candidate.protocol);
        } else {
          console.log("ICE candidate gathering complete");
        }
      };
      pc.onicecandidateerror = (evt) => {
        console.warn("ICE candidate error:", evt);
      };
      pc.onconnectionstatechange = () => {
        console.log("Peer connection state:", pc.connectionState);
        if (pc.connectionState === "failed") {
          setStatus("Connection failed");
        }
      };

      // Hidden <audio> element for inbound assistant TTS
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      // Set playsInline for mobile compatibility
      if ('playsInline' in audioEl) {
        (audioEl as HTMLVideoElement).playsInline = true;
      }

      // Inbound track => assistant's TTS
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        const attemptPlay = () => {
          const p = audioEl.play();
          if (p && typeof p.then === "function") {
            p.catch((e: Error) => console.warn("audio.play() blocked:", e));
          }
        };
        // Try immediately and after a tick
        attemptPlay();
        setTimeout(attemptPlay, 0);

        // Optional: measure inbound volume
        const AudioContextCtor =
          window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
          console.error('AudioContext not supported for volume analysis');
          return;
        }
        const audioCtx = new AudioContextCtor();
        const src = audioCtx.createMediaStreamSource(event.streams[0]);
        const inboundAnalyzer = audioCtx.createAnalyser();
        inboundAnalyzer.fftSize = 256;
        src.connect(inboundAnalyzer);
        analyserRef.current = inboundAnalyzer;

        // Start volume monitoring
        volumeIntervalRef.current = window.setInterval(() => {
          setCurrentVolume(getVolume());
        }, 100);
      };

      // Data channel for transcripts
      const dataChannel = pc.createDataChannel("response");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        // console.log("Data channel open");
        configureDataChannel(dataChannel);
      };
      dataChannel.onmessage = handleDataChannelMessage;

      // Add local (mic) track
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      // Create offer & set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (no trickle ICE over HTTP)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", checkState);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", checkState);
        // Fallback timeout in case we never get the event
        setTimeout(() => {
          pc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }, 2000);
      });

      // Send SDP offer (with gathered ICE) to OpenAI Realtime
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const response = await fetch(`${baseUrl}?model=${model}&voice=${voice}`, {
        method: "POST",
        body: pc.localDescription?.sdp || offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
      });

      // Set remote description
      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setIsSessionActive(true);
      setStatus("Session established successfully!");

      // Record session start
      sessionStartRef.current = new Date();
      currentSessionIdRef.current = uuidv4();
    } catch (err) {
      console.error("startSession error:", err);
      setStatus(`Error: ${err}`);
      stopSession();
    }
  }

  /**
   * Stop the session & cleanup
   */
  function stopSession() {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioIndicatorRef.current) {
      audioIndicatorRef.current.classList.remove("active");
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    analyserRef.current = null;

    ephemeralUserMessageIdRef.current = null;

    setCurrentVolume(0);
    setIsSessionActive(false);
    setStatus("Session stopped");

    // Leave a small mic session marker for the thread UI
    if (sessionStartRef.current) {
      const endedAt = new Date();
      const startedAtIso = sessionStartRef.current.toISOString();
      const endedAtIso = endedAt.toISOString();
      const markerId = currentSessionIdRef.current ?? uuidv4();
      setMicSessions((prev) => [
        ...prev,
        { id: markerId, startedAt: startedAtIso, endedAt: endedAtIso, threadId: options?.threadId },
      ]);
    }
    sessionStartRef.current = null;
    currentSessionIdRef.current = null;
  }

  /**
   * Toggle start/stop from a single button
   */
  function handleStartStopClick() {
    if (isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  }

  /**
   * Send a text message through the data channel
   */
  function sendTextMessage(text: string) {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      console.error("Data channel not ready");
      return;
    }

    const messageId = uuidv4();
    
    // Add message to conversation immediately
    const newMessage: Conversation = {
      id: messageId,
      role: "user",
      text,
      timestamp: new Date().toISOString(),
      isFinal: true,
      status: "final",
    };
    
    setConversation(prev => [...prev, newMessage]);

    // Send message through data channel
    const message = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: text,
          },
        ],
      },
    };

    const response = {
      type: "response.create",
    };
    
    dataChannelRef.current.send(JSON.stringify(message));
    dataChannelRef.current.send(JSON.stringify(response));}

  // Cleanup on unmount
  useEffect(() => {
    return () => stopSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter mic sessions to the current thread if provided
  const scopedMicSessions = useMemo(
    () =>
      micSessions.filter((s) =>
        options?.threadId ? s.threadId === options.threadId : true,
      ),
    [micSessions, options?.threadId],
  );

  return {
    status,
    isSessionActive,
    audioIndicatorRef,
    startSession,
    stopSession,
    handleStartStopClick,
    registerFunction,
    msgs,
    currentVolume,
    conversation,
    sendTextMessage,
    // Expose mic session markers so the thread can render a small message
    micSessions: scopedMicSessions,
  };
}