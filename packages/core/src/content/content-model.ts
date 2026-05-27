export interface FieldModel {
  name: string;
  type: string;
  required: boolean;
  localized: boolean;
}

export interface BlockModel {
  slug: string;
  fields: FieldModel[];
  source: 'top-level' | 'inline';
  ownerCollection?: string;
}

export interface CollectionModel {
  slug: string;
  fields: FieldModel[];
  versions: boolean;
  draftEnabled: boolean;
}

export interface GlobalModel {
  slug: string;
  fields: FieldModel[];
}

export interface LocalizationModel {
  locales: string[];
  defaultLocale?: string;
}

export interface ContentModel {
  collections: CollectionModel[];
  globals: GlobalModel[];
  blocks: BlockModel[];
  localization?: LocalizationModel;
}
