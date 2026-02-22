import { Search, MapPin, BriefcaseIcon, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Filters {
  search: string;
  location: string;
  type: string;
}

interface SearchFiltersProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
}

export function SearchFilters({ filters, setFilters }: SearchFiltersProps) {
  const handleReset = () => {
    setFilters({ search: "", location: "", type: "" });
  };

  const hasActiveFilters = filters.search || filters.location || filters.type;

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm mb-8 space-y-4 md:space-y-0 md:flex md:gap-4 items-center">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search by title, company, or keywords..." 
          className="pl-9 bg-background/50 border-border/50 focus:bg-background transition-colors"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>

      <div className="w-full md:w-48">
        <Select 
          value={filters.location} 
          onValueChange={(val) => setFilters({ ...filters, location: val })}
        >
          <SelectTrigger className="bg-background/50 border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <SelectValue placeholder="Location" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="remote">Remote Only</SelectItem>
            <SelectItem value="worldwide">Worldwide</SelectItem>
            <SelectItem value="usa">USA</SelectItem>
            <SelectItem value="europe">Europe</SelectItem>
            <SelectItem value="asia">Asia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full md:w-48">
        <Select 
          value={filters.type} 
          onValueChange={(val) => setFilters({ ...filters, type: val })}
        >
          <SelectTrigger className="bg-background/50 border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BriefcaseIcon className="w-4 h-4" />
              <SelectValue placeholder="Job Type" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full-time">Full Time</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="part-time">Part Time</SelectItem>
            <SelectItem value="freelance">Freelance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleReset}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title="Clear filters"
        >
          <FilterX className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
