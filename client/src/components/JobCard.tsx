import { motion } from "framer-motion";
import { Building2, MapPin, Clock, CalendarDays, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Job } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface JobCardProps {
  job: Job;
  index: number;
}

export function JobCard({ job, index }: JobCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative bg-card hover:bg-card/50 border border-border/50 hover:border-primary/20 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300"
    >
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {job.title}
              </h3>
              <div className="flex items-center gap-2 text-muted-foreground font-medium">
                <Building2 className="w-4 h-4" />
                <span>{job.company}</span>
              </div>
            </div>
            
            {/* Mobile apply button (hidden on desktop) */}
            <div className="md:hidden">
              <Button size="icon" variant="ghost" asChild>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5" />
                </a>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
              <MapPin className="w-3.5 h-3.5" />
              {job.location}
            </div>
            <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5" />
              {job.jobType}
            </div>
            {job.createdAt && (
              <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold text-primary border-primary/20 bg-primary/5">
              {job.source}
            </Badge>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-end gap-3 min-w-[140px]">
          <Button 
            className="w-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
            asChild
          >
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              Apply Now
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
          <span className="text-xs text-muted-foreground/60 text-right block w-full px-1">
            via {job.source}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
