/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

export const EMBEDDING_MODEL_ID = "onnx-community/siglip2-base-patch16-224-ONNX";

interface ProgressEvent {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

type IncomingMessage =
  | { type: "embedImage"; id: string; blob: Blob }
  | { type: "embedText"; queryId: string; text: string };

type OutgoingMessage =
  | { type: "progress"; data: ProgressEvent }
  | { type: "ready"; modelId: string }
  | { type: "imageResult"; id: string; embedding: number[] }
  | { type: "imageError"; id: string; error: string }
  | { type: "textResult"; queryId: string; embedding: number[] }
  | { type: "textError"; queryId: string; error: string };

type ForwardCallable = (inputs: unknown) => Promise<{ pooler_output: { data: Float32Array } }>;

interface LoadedModel {
  tokenizer: (texts: string[], options: any) => unknown;
  processor: (image: unknown) => Promise<unknown>;
  visionModel: ForwardCallable;
  textModel: ForwardCallable;
  RawImage: { fromBlob: (blob: Blob) => Promise<unknown> };
}

let modelPromise: Promise<LoadedModel> | null = null;

function post(message: OutgoingMessage) {
  self.postMessage(message);
}

async function loadModel(): Promise<LoadedModel> {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    // Dynamic import keeps the bundle slim and side-steps a type-export
    // mismatch in @huggingface/transformers' published .d.ts files.
    const mod = (await import("@huggingface/transformers")) as unknown as {
      AutoTokenizer: {
        from_pretrained: (id: string, options?: unknown) => Promise<LoadedModel["tokenizer"]>;
      };
      AutoProcessor: {
        from_pretrained: (id: string, options?: unknown) => Promise<LoadedModel["processor"]>;
      };
      SiglipVisionModel: {
        from_pretrained: (id: string, options?: unknown) => Promise<ForwardCallable>;
      };
      SiglipTextModel: {
        from_pretrained: (id: string, options?: unknown) => Promise<ForwardCallable>;
      };
      RawImage: LoadedModel["RawImage"];
    };

    const onProgress = (data: ProgressEvent) => post({ type: "progress", data });

    const [tokenizer, processor, visionModel, textModel] = await Promise.all([
      mod.AutoTokenizer.from_pretrained(EMBEDDING_MODEL_ID, { progress_callback: onProgress }),
      mod.AutoProcessor.from_pretrained(EMBEDDING_MODEL_ID, { progress_callback: onProgress }),
      mod.SiglipVisionModel.from_pretrained(EMBEDDING_MODEL_ID, {
        // device: "webgpu",
        dtype: "uint8",
        progress_callback: onProgress,
      }),
      mod.SiglipTextModel.from_pretrained(EMBEDDING_MODEL_ID, {
        // device: "webgpu",
        dtype: "uint8",
        progress_callback: onProgress,
      }),
    ]);

    post({ type: "ready", modelId: EMBEDDING_MODEL_ID });
    return { tokenizer, processor, visionModel, textModel, RawImage: mod.RawImage };
  })().catch((err) => {
    modelPromise = null;
    throw err;
  });

  return modelPromise;
}

async function embedImage(blob: Blob): Promise<number[]> {
  const { processor, visionModel, RawImage } = await loadModel();
  const image = await RawImage.fromBlob(blob);
  const inputs = await processor(image);
  const { pooler_output } = await visionModel(inputs);
  return Array.from(pooler_output.data);
}

async function embedText(text: string): Promise<number[]> {
  const { tokenizer, textModel } = await loadModel();
  const inputs = tokenizer([text], { padding: "max_length", max_length: 64, truncation: true });
  const { pooler_output } = await textModel(inputs);
  return Array.from(pooler_output.data);
}

self.addEventListener("message", (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  void (async () => {
    if (msg.type === "embedImage") {
      try {
        const embedding = await embedImage(msg.blob);
        post({ type: "imageResult", id: msg.id, embedding });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        post({ type: "imageError", id: msg.id, error: message });
      }
    } else if (msg.type === "embedText") {
      try {
        const embedding = await embedText(msg.text);
        post({ type: "textResult", queryId: msg.queryId, embedding });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        post({ type: "textError", queryId: msg.queryId, error: message });
      }
    }
  })();
});
