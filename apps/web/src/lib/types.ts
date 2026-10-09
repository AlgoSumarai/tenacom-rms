export type Role = "Admin" | "Manager" | "Resource";
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  version: number;
};
export type Page<T> = {
  items: T[];
  total: number;
  pageNumber: number;
  pageSize: number;
};
export type Term = { id: string; kind: string; name: string };
export type ProfileTerm = {
  termId: string;
  kind?: string;
  name?: string;
  proficiency: string;
  years: number | null;
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  headline: string;
  summary: string;
  phone: string;
  location: string;
  status: string;
  reviewStatus: string;
  reviewNote: string;
  version: number;
  terms: ProfileTerm[];
  completeness: number;
};
export type ProfileInput = Pick<
  Profile,
  | "name"
  | "headline"
  | "summary"
  | "phone"
  | "location"
  | "status"
  | "terms"
  | "version"
>;
export type Project = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string | null;
  version: number;
};
export type Assignment = {
  id: string;
  projectId: string;
  projectName: string;
  resourceId: string;
  resourceName: string;
  roleDescription: string;
  startDate: string;
  endDate: string | null;
  version: number;
};
export type TimeEntry = {
  id: string;
  assignmentId: string;
  projectId: string;
  projectName: string;
  resourceId: string;
  resourceName: string;
  workDate: string;
  minutes: number;
  notes: string;
  createdBy: string;
  createdByName: string;
  version: number;
};
export type Hours = {
  resourceId: string;
  resourceName: string;
  projectId: string;
  projectName: string;
  minutes: number;
};
export type HoursReport = Page<Hours> & { totalMinutes: number };
export type Invitation = {
  id: string;
  label: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  revoked: boolean;
};
