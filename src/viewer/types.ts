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

export interface SwingAnalysisViewerDefinition {
  kind: "swing-analysis";
  dataUrl: string;
}

export type ViewerDefinition =
  | MeshSequenceViewerDefinition
  | IframeViewerDefinition
  | SwingAnalysisViewerDefinition;

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
    swing?: SwingAnalysisViewerDefinition;
    soma?: ViewerDefinition;
    kinetic?: IframeViewerDefinition;
  };
}

export type ViewerKey = "swing" | "soma" | "kinetic";

export interface SwingPhase {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface SwingAnnotation {
  id: string;
  title: string;
  detail: string;
  start: number;
  end: number;
  anchor: string;
  group: string | null;
}

export interface SwingMuscleGroup {
  id: string;
  label: string;
  role: string;
  color: string;
  muscles: string[];
}

/** Output of scripts/build-golf-swing-analysis.py. */
export interface SwingAnalysisBundle {
  format: "cerebel-swing-analysis-v1";
  fps: number;
  sourceStartFrame: number;
  frameCount: number;
  impactIndex: number;
  phases: SwingPhase[];
  disclosure: { badge: string; club: string; coaching: string };
  /** Measured strengths, shown beside the findings. */
  highlights: string[];
  surface: {
    label: string;
    vertexCount: number;
    facesUrl: string;
    verticesUrl: string;
    quantisation: { offset: [number, number, number]; scale: [number, number, number] };
    ground: number;
    height: number;
    /** Horizontal facing direction and target direction, measured from the capture. */
    forward: [number, number, number];
    target: [number, number, number];
    ball: [number, number, number];
    /** Per frame: grip xyz, head xyz. */
    club: number[][];
  };
  skeleton: {
    label: string;
    boneModelUrl: string;
    toSurfaceAxes: number[][];
    scaleToSurface: number;
    ground: number;
    target: [number, number, number];
    up: [number, number, number];
    bodyNames: string[];
    /** Per frame, per body: position xyz + quaternion xyzw. */
    frames: number[][];
    muscleNames: string[];
    /** Per frame, per muscle: path points. */
    muscles: number[][][][];
    ball: [number, number, number];
    club: number[][];
  };
  annotations: SwingAnnotation[];
  muscleGroups: SwingMuscleGroup[];
}
