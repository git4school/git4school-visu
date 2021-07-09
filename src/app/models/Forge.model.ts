enum ForgeType {
  Github = "GITHUB",
  Gitlab = "GITLAB",
}

export class Forge {
  name: string;

  apiURL: string;

  hosted: boolean;

  type: ForgeType;

  isEqual(forge: Forge): boolean {
    return this.name === forge.name && this.type === forge.type;
  }
}
