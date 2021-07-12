export enum ForgeType {
  Github = "GITHUB",
  Gitlab = "GITLAB",
}

export class Forge {
  name: string;

  apiURL: string;

  hosted: boolean;

  type: ForgeType;

  constructor(name: string, apiURL: string, type: ForgeType, hosted: boolean) {
    this.name = name;
    this.apiURL = apiURL;
    this.type = type;
    this.hosted = hosted;
  }

  isEqual(forge: Forge): boolean {
    return this.name === forge.name && this.type === forge.type;
  }
}
