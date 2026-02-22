// Type definitions for Job entities

export interface Job {
  id: number;
  apiId: string;
  title: string;
  company: string;
  location: string;
  jobType: string;
  description: string;
  url: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertJob {
  apiId: string;
  title: string;
  company: string;
  location: string;
  jobType: string;
  description: string;
  url: string;
  source: string;
}

export interface SavedJob {
  id: number;
  jobId: number;
  savedAt: Date | null;
}

export type JobResponse = Job;
export type JobsListResponse = {
  jobs: Job[];
  total: number;
  sources: Record<string, number>;
  lastUpdated: string | null;
};
