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
