import React from "react";

import type { FC } from "react";
import { MicIcon, Square } from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";

type MicActionButtonProps = {
  isSessionActive: boolean;
  handleStartStopClick: () => void;
};

export const MicActionButton: FC<MicActionButtonProps> = ({
  isSessionActive,
  handleStartStopClick,
}) => {
  return (
    <>
      {isSessionActive ? (
        <TooltipIconButton
          tooltip="Voice active"
          side="bottom"
          type="button"
          variant="default"
          size="icon"
          className="aui-composer-mic size-[34px] rounded-full p-1"
          aria-label="Voice active"
          onClick={handleStartStopClick}
        >
          <Square className="size-5" />
        </TooltipIconButton>
      ) : (
        <TooltipIconButton
          tooltip="Start voice"
          side="bottom"
          type="button"
          variant="default"
          size="icon"
          className="aui-composer-mic size-[34px] rounded-full p-1"
          aria-label="Start voice"
          onClick={handleStartStopClick}
        >
          <MicIcon className="size-5" />
        </TooltipIconButton>
      )}
    </>
  );
};

