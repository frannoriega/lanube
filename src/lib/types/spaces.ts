/**
 * A single FAQ entry shown on the public "Espacios" page. `answer` is markdown (rendered
 * with the shared <Markdown> component). Persisted as a JSON array on `Space.faqs`.
 */
export type SpaceFaq = {
  question: string;
  answer: string;
};

export type SpaceMetadataItem =
  | {
      type: "stat";
      label?: string;
      value: string;
      description?: string;
      icon: string;
    }
  | {
      type: "fraction";
      label?: string;
      numerator: number;
      denominator: number;
      description?: string;
      icon: string;
    };
