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

export class PDFAttachmentAdapter implements AttachmentAdapter {
  accept = "application/pdf";
  async add({ file }: { file: File }): Promise<PendingAttachment> {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("PDF size exceeds 10MB limit");
    }
    return {
      id: crypto.randomUUID(),
      type: "document",
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "running", reason: "uploading", progress: 100 },
    } as PendingAttachment;
  }
  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    type FilePendingAttachment = PendingAttachment & { file: File; name: string };
    const fileAttachment = attachment as FilePendingAttachment;
    const dataUrl = await this.fileToBase64DataURL(fileAttachment.file);
    return {
      id: attachment.id,
      type: "document",
      name: fileAttachment.name,
      contentType: fileAttachment.file.type,
      content: [
        {
          type: "file",
          filename: fileAttachment.name,
          data: dataUrl,
          mimeType: fileAttachment.file.type || "application/pdf",
        },
      ],
      status: { type: "complete" },
    } as CompleteAttachment;
  }
  async remove(): Promise<void> {
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


