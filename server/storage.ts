import { type Job, type InsertJob } from "@shared/schema";

// ─── Shared filter type ───────────────────────────────────────────────────────

export interface JobFilters {
  search?: string;
  location?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

// ─── Storage Interface ────────────────────────────────────────────────────────

export interface IStorage {
  getJobs(filters: JobFilters): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  getJobCount(): Promise<number>;
  getSearchJobCount(filters: Pick<JobFilters, "search" | "location" | "type">): Promise<number>;
  getJobSourcesCount(): Promise<Record<string, number>>;
  getLastUpdated(): Promise<string | null>;
  upsertJobs(newJobs: InsertJob[]): Promise<void>;
  saveJob(jobId: number): Promise<void>;
  unsaveJob(jobId: number): Promise<void>;
  isJobSaved(jobId: number): Promise<boolean>;
  getSavedJobs(): Promise<(Job & { savedAt: Date | null })[]>;
}

// ─── In-Memory Storage ────────────────────────────────────────────────────────

class MemoryStorage implements IStorage {
  private jobMap: Map<number, Job> = new Map();
  private savedIds: Set<number> = new Set();
  private savedTimes: Map<number, Date> = new Map();
  private nextId = 1;
  private lastUpsertAt: Date | null = null;

  private matches(
    job: Job,
    search?: string,
    location?: string,
    type?: string,
  ): boolean {
    if (search && !job.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (location && !job.location.toLowerCase().includes(location.toLowerCase())) return false;
    if (type && !job.jobType.toLowerCase().includes(type.toLowerCase())) return false;
    return true;
  }

  async getJobs({ search, location, type, limit = 20, offset = 0 }: JobFilters): Promise<Job[]> {
    const filtered = Array.from(this.jobMap.values())
      .filter((j) => this.matches(j, search, location, type))
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    return filtered.slice(offset, offset + limit);
  }

  async getJob(id: number): Promise<Job | undefined> {
    return this.jobMap.get(id);
  }

  async getJobCount(): Promise<number> {
    return this.jobMap.size;
  }

  async getSearchJobCount({ search, location, type }: Pick<JobFilters, "search" | "location" | "type">): Promise<number> {
    return Array.from(this.jobMap.values()).filter((j) =>
      this.matches(j, search, location, type),
    ).length;
  }

  async getJobSourcesCount(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const job of Array.from(this.jobMap.values())) {
      counts[job.source] = (counts[job.source] || 0) + 1;
    }
    return counts;
  }

  async getLastUpdated(): Promise<string | null> {
    return this.lastUpsertAt ? this.lastUpsertAt.toISOString() : null;
  }

  async upsertJobs(newJobs: InsertJob[]): Promise<void> {
    if (newJobs.length === 0) return;
    const existingApiIds = new Set(Array.from(this.jobMap.values()).map((j) => j.apiId));
    for (const job of newJobs) {
      if (!existingApiIds.has(job.apiId)) {
        const id = this.nextId++;
        this.jobMap.set(id, { id, ...job, createdAt: new Date(), updatedAt: new Date() });
        existingApiIds.add(job.apiId);
      }
    }
    this.lastUpsertAt = new Date();
  }

  async saveJob(jobId: number): Promise<void> {
    this.savedIds.add(jobId);
    this.savedTimes.set(jobId, new Date());
  }

  async unsaveJob(jobId: number): Promise<void> {
    this.savedIds.delete(jobId);
    this.savedTimes.delete(jobId);
  }

  async isJobSaved(jobId: number): Promise<boolean> {
    return this.savedIds.has(jobId);
  }

  async getSavedJobs(): Promise<(Job & { savedAt: Date | null })[]> {
    const result: (Job & { savedAt: Date | null })[] = [];
    for (const id of Array.from(this.savedIds)) {
      const job = this.jobMap.get(id);
      if (job) result.push({ ...job, savedAt: this.savedTimes.get(id) ?? null });
    }
    return result.sort((a, b) => (b.savedAt?.getTime() ?? 0) - (a.savedAt?.getTime() ?? 0));
  }
}

// ─── Export in-memory storage as the only implementation ──────────────────────

console.log("📦 Using in-memory storage (data will be reset on server restart)");
export const storage: IStorage = new MemoryStorage();