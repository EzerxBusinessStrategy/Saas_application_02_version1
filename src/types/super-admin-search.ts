export type SuperAdminSearchResult = {
  id: string;
  type: "tenant" | "user";
  title: string;
  subtitle: string | null;
  code: string | null;
  status: string;
  href: string;
};

export type SuperAdminSearchResponse = {
  query: string;
  limit: number;
  results: SuperAdminSearchResult[];
};
