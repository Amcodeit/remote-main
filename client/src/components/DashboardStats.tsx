import { motion } from "framer-motion";
import { Briefcase, Globe, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardStatsProps {
  totalJobs: number;
  sources: Record<string, number>;
  lastUpdated: string | null;
}

export function DashboardStats({ totalJobs, sources, lastUpdated }: DashboardStatsProps) {
  const sourceCount = Object.keys(sources).length;
  const topSource = Object.entries(sources).sort(([,a], [,b]) => b - a)[0];

  const stats = [
    {
      label: "Total Opportunities",
      value: totalJobs.toLocaleString(),
      icon: Briefcase,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      delay: 0
    },
    {
      label: "Active Sources",
      value: sourceCount.toString(),
      icon: Globe,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      delay: 0.1
    },
    {
      label: "Top Platform",
      value: topSource ? topSource[0] : "N/A",
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      delay: 0.2
    },
    {
      label: "New Today",
      value: "24", // Placeholder as API doesn't give this direct stat yet
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      delay: 0.3
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: stat.delay, duration: 0.4 }}
        >
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
