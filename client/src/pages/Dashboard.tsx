import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";
import { JobCard } from "@/components/JobCard";
import { DashboardStats } from "@/components/DashboardStats";
import { SearchFilters } from "@/components/SearchFilters";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const [filters, setFilters] = useState({
    search: "",
    location: "",
    type: "",
    page: 1
  });

  const { data, isLoading, isError, error } = useJobs(filters);

  // Debounce filter updates could be added here for production
  // For now, React's fast enough to handle direct binding

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Header */}
      <header className="relative bg-gradient-to-b from-primary/5 to-background pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4 border border-primary/20">
              Live Job Updates
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
              Remote Job <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Tracker</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Curated opportunities from the best remote-first companies. 
              Aggregated from multiple sources in real-time.
            </p>
          </motion.div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground animate-pulse">Fetching latest opportunities...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-destructive/10 p-4 rounded-full mb-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Failed to load jobs</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              {(error as Error).message || "An unexpected error occurred while connecting to the server."}
            </p>
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <DashboardStats 
              totalJobs={data?.total || 0} 
              sources={data?.sources || {}} 
              lastUpdated={data?.lastUpdated || null}
            />

            <SearchFilters 
              filters={filters} 
              setFilters={(newFilters) => setFilters({...filters, ...newFilters})} // Preserve page
            />

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold tracking-tight">
                Latest Openings
                <span className="ml-3 text-sm font-normal text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                  {data?.total} found
                </span>
              </h2>
            </div>

            <div className="space-y-4">
              {data?.jobs.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
                  <p className="text-lg font-medium text-foreground">No jobs found matching your criteria</p>
                  <p className="text-muted-foreground mt-1">Try adjusting your filters or search terms</p>
                  <Button 
                    variant="ghost" 
                    className="mt-4 text-primary"
                    onClick={() => setFilters({ search: "", location: "", type: "", page: 1 })}
                  >
                    Clear all filters
                  </Button>
                </div>
              ) : (
                data?.jobs.map((job, index) => (
                  <JobCard key={job.id} job={job} index={index} />
                ))
              )}
            </div>

            {/* Pagination Placeholder - API supports page param, so we could build this out fully */}
            {data && data.total > 20 && (
              <div className="mt-8 flex justify-center gap-2">
                 <Button 
                   variant="outline" 
                   disabled={filters.page <= 1}
                   onClick={() => setFilters(p => ({ ...p, page: (p.page || 1) - 1 }))}
                 >
                   Previous
                 </Button>
                 <Button 
                   variant="outline"
                   disabled={data.jobs.length < 20} // Simple check assuming page size 20
                   onClick={() => setFilters(p => ({ ...p, page: (p.page || 1) + 1 }))}
                 >
                   Next
                 </Button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-20 border-t border-border/50 py-12 bg-card">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Remote Job Tracker. Built with React & Tailwind.
          </p>
        </div>
      </footer>
    </div>
  );
}
