import React from 'react';
import FeedbackComments from '@/components/FeedbackComments';
import { MessageSquare } from 'lucide-react';

export default function Comments() {
  return (
    <div className="container mx-auto py-6 sm:py-8 px-2 sm:px-4 max-w-4xl font-jakarta-sans">
      <div className="text-center mb-4 sm:mb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[11px] sm:text-xs font-black uppercase tracking-wider border border-blue-200 dark:border-blue-800">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>User Feedback & Suggestions</span>
        </div>
        <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Application Comments & Feedback
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto px-2">
          Share your experience, suggest improvements, or ask questions. Your feedback is sent directly to the platform superadmin.
        </p>
      </div>

      <div className="flex justify-center w-full px-1">
        <FeedbackComments />
      </div>
    </div>
  );
}
