import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { JobsListResponse, JobResponse } from "@shared/schema";

interface JobFilters {
  search?: string;
  location?: string;
  type?: string;
  page?: number;
}

export function useJobs(filters: JobFilters = {}) {
  // Construct query key based on filters to ensure caching works per filter set
  const queryKey = [api.jobs.list.path, filters];

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Build URL with query parameters
      const params: Record<string, string | number> = {};
      if (filters.search) params.search = filters.search;
      if (filters.location) params.location = filters.location;
      if (filters.type) params.type = filters.type;
      if (filters.page) params.page = filters.page;

      const queryString = new URLSearchParams(
        params as Record<string, string>
      ).toString();
      
      const url = `${api.jobs.list.path}?${queryString}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      
      // Parse with Zod schema from shared routes
      return api.jobs.list.responses[200].parse(await res.json());
    },
    // Keep previous data while fetching new data for smooth pagination/filtering
    placeholderData: (previousData) => previousData,
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: [api.jobs.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.jobs.get.path, { id });
      const res = await fetch(url);
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch job details");
      
      return api.jobs.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}
