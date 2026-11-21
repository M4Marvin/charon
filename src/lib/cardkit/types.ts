export type Greeting = {
  /** file name, or `greetings.md#N` for split files */
  id: string;
  text: string;
  images: string[];
};

export type CardPackage = {
  dir: string;
  name: string;
  page: string | null;
  personality: string | null;
  tagline: string | null;
  greetings: Greeting[];
  /** unique image URLs across the page and every greeting */
  images: string[];
};

export type IssueLevel = "error" | "warn";
export type Issue = { level: IssueLevel; code: string; message: string };

export type CheckResult = {
  ok: boolean;
  issues: Issue[];
  stats: {
    greetings: number;
    images: number;
    taglineGreetings: number | null;
    taglineImages: number | null;
    cssBytes: number;
  };
};
