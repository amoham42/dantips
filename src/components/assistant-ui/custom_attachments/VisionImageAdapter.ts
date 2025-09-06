import type {
  Attachment,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";

export type AttachmentAdapter = {
  accept: string;
  add(state: { file: File }): Promise<PendingAttachment> | AsyncGenerator<PendingAttachment, void>;
  remove(attachment: Attachment): Promise<void>;
  send(attachment: PendingAttachment): Promise<CompleteAttachment>;
};

export class VisionImageAdapter implements AttachmentAdapter {
  public accept = "image/jpeg,image/png,image/webp,image/gif";

  public async add({ file }: { file: File }): Promise<PendingAttachment> {
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      throw new Error("Image size exceeds 20MB limit");
    }
    return {
      id: crypto.randomUUID(),
      type: "image",
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "running", reason: "uploading", progress: 100 },
    };
  }

  public async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const base64 = await this.fileToBase64DataURL(attachment.file);
    return {
      id: attachment.id,
      type: "image",
      name: attachment.name,
      contentType: attachment.contentType,
      content: [
        {
          type: "image",
          image: base64,
        },
      ],
      status: { type: "complete" },
    };
  }

  public async remove(): Promise<void> {
    return;
  }

  private async fileToBase64DataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}


