"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Download, Copy, CheckCircle2, FileText, HelpCircle, Lightbulb, ListTodo } from "lucide-react";
import ReactMarkdown from "react-markdown";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SummaryData {
  decisions: string[];
  tasks: Array<{
    title: string;
    assignee: string;
    status: string;
  }>;
  questions: string[];
  themes: string;
  markdown: string;
}

interface SummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
}

export function SummaryModal({ open, onOpenChange, roomId }: SummaryModalProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate summary
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_URL}/api/rooms/${roomId}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      setSummary(data);
    } catch (err: any) {
      console.error("Summary generation error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export as markdown file
  const handleExport = () => {
    if (!summary) return;
    
    const token = localStorage.getItem("auth_token");
    window.location.href = `${API_URL}/api/rooms/${roomId}/summary/export?token=${token}`;
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!summary) return;
    
    try {
      await navigator.clipboard.writeText(summary.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Session Summary
          </DialogTitle>
          <DialogDescription>
            AI-powered summary of your collaborative session with decisions, tasks, and key themes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Generate button */}
          {!summary && !loading && (
            <div className="text-center py-8">
              <Button onClick={handleGenerate} size="lg">
                <Lightbulb className="h-4 w-4 mr-2" />
                Generate Summary
              </Button>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Analyzing session with AI...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <Card className="p-4 border-destructive bg-destructive/5">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={handleGenerate} variant="outline" size="sm" className="mt-2">
                Retry
              </Button>
            </Card>
          )}

          {/* Summary content */}
          {summary && (
            <>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button onClick={handleExport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export as Markdown
                </Button>
                <Button onClick={handleCopy} variant="outline" size="sm">
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
                <Button onClick={handleGenerate} variant="ghost" size="sm" className="ml-auto">
                  Regenerate
                </Button>
              </div>

              {/* Structured sections */}
              <div className="space-y-4">
                {/* Decisions */}
                {summary.decisions.length > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <h3 className="font-semibold">Decisions Made</h3>
                      <Badge variant="secondary">{summary.decisions.length}</Badge>
                    </div>
                    <ul className="space-y-2">
                      {summary.decisions.map((decision, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">•</span>
                          <span>{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Tasks */}
                {summary.tasks.length > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ListTodo className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Tasks Assigned</h3>
                      <Badge variant="secondary">{summary.tasks.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {summary.tasks.map((task, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                          <span className="flex-1">{task.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">{task.assignee}</span>
                            <Badge
                              variant={
                                task.status === "done"
                                  ? "default"
                                  : task.status === "in_progress"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {task.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Questions */}
                {summary.questions.length > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <HelpCircle className="h-5 w-5 text-warning" />
                      <h3 className="font-semibold">Open Questions</h3>
                      <Badge variant="secondary">{summary.questions.length}</Badge>
                    </div>
                    <ul className="space-y-2">
                      {summary.questions.map((question, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">•</span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Themes */}
                {summary.themes && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-accent" />
                      <h3 className="font-semibold">Key Themes</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{summary.themes}</p>
                  </Card>
                )}

                {/* Full markdown */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Full Summary</h3>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{summary.markdown}</ReactMarkdown>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
