export interface MeshSequenceMetadata {
  format: "cerebel-mesh-sequence-v1";
  source: string;
  vertexCount: number;
  triangleCount: number;
  frameCount: number;
  fps: number;
  verticesUrl: string;
  facesUrl: string;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

export interface MeshSequenceViewerDefinition {
  kind: "mesh-sequence";
  metadataUrl: string;
}

export interface IframeViewerDefinition {
  kind: "iframe";
  url: string;
}

export type ViewerDefinition =
  | MeshSequenceViewerDefinition
  | IframeViewerDefinition;

export interface ViewerSession {
  id: string;
  label: string;
  description: string;
  capturedAt: string | null;
  fps: number;
  frameCount: number;
  status: "qualitative" | "development";
  source: string;
  viewers: {
    soma?: ViewerDefinition;
    kinetic?: IframeViewerDefinition;
  };
}

export type ViewerKey = "soma" | "kinetic";
