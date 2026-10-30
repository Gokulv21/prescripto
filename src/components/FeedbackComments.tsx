import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useParams, useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  MessageSquare, Heart, Send, CheckCheck, Clock, ShieldCheck, 
  Trash2, Sparkles, User, RefreshCw, EyeOff
} from 'lucide-react';
import './FeedbackComments.css';

export interface FeedbackComment {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  clinic_id?: string;
  clinic_name?: string;
  content: string;
  created_at: string;
  likes: number;
  liked_by?: string[];
  is_read?: boolean;
  read_at?: string | null;
}

export default function FeedbackComments() {
  const { user, profile, roles } = useAuth();
  const { slug } = useParams();
  const outletCtx = useOutletContext<{ clinic?: any }>() || {};
  const clinic = outletCtx?.clinic;

  const isSuperAdmin = Boolean(
    profile?.is_superadmin === true ||
    roles.includes('superadmin') ||
    user?.email?.toLowerCase() === 'doctor@clinic.com' ||
    profile?.email?.toLowerCase() === 'doctor@clinic.com'
  );

  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const effectiveClinicId = clinic?.id || profile?.clinic_id;

  // Fetch comments
  const fetchComments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('medicine_protocols')
        .select('*')
        .eq('name', '__APP_FEEDBACK__')
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && effectiveClinicId) {
        query = query.eq('clinic_id', effectiveClinicId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const loaded: FeedbackComment[] = [];
      const now = Date.now();
      const expiredProtocolIds: string[] = [];

      (data || []).forEach((row: any) => {
        const list: FeedbackComment[] = Array.isArray(row.medicines) ? row.medicines : [];
        list.forEach((item) => {
          // If marked as read more than 24 hours ago, auto-vanish
          if (item.is_read && item.read_at) {
            const readTime = new Date(item.read_at).getTime();
            if (now - readTime > 24 * 60 * 60 * 1000) {
              expiredProtocolIds.push(row.id);
              return;
            }
          }
          loaded.push({ ...item, id: item.id || row.id });
        });
      });

      // Cleanup expired comments from cloud in background
      if (expiredProtocolIds.length > 0 && isSuperAdmin) {
        supabase
          .from('medicine_protocols')
          .delete()
          .in('id', expiredProtocolIds)
          .then();
      }

      // Sort newest first
      loaded.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setComments(loaded);
    } catch (err: any) {
      console.warn('Could not load feedback comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [effectiveClinicId, isSuperAdmin]);

  // Handle post new comment
  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim()) return;

    if (!user || !effectiveClinicId) {
      toast.error('Unable to send feedback. Please ensure clinic is active.');
      return;
    }

    setSubmitting(true);
    try {
      const authorName = profile?.full_name || user?.email?.split('@')[0] || 'Clinic User';
      const authorRole = (profile?.role || (roles.includes('doctor') ? 'doctor' : 'staff')) as string;
      const clinicName = clinic?.name || profile?.clinic_name || 'Prescripto Clinic';

      const newComment: FeedbackComment = {
        id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        author_id: user.id,
        author_name: authorName,
        author_role: authorRole,
        clinic_id: effectiveClinicId,
        clinic_name: clinicName,
        content: replyText.trim(),
        created_at: new Date().toISOString(),
        likes: 0,
        liked_by: [],
        is_read: false,
        read_at: null
      };

      const { error } = await supabase.from('medicine_protocols').insert({
        name: '__APP_FEEDBACK__',
        clinic_id: effectiveClinicId,
        medicines: [newComment]
      });

      if (error) throw error;

      toast.success('Thank you! Your feedback has been sent to SuperAdmin.');
      setReplyText('');
      setSelectedFormat(null);
      await fetchComments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Like reaction on a comment
  const handleLike = async (cmt: FeedbackComment) => {
    if (!user) return;
    try {
      const alreadyLiked = (cmt.liked_by || []).includes(user.id);
      const newLikedBy = alreadyLiked
        ? (cmt.liked_by || []).filter(id => id !== user.id)
        : [...(cmt.liked_by || []), user.id];
      const newLikesCount = Math.max(0, alreadyLiked ? cmt.likes - 1 : cmt.likes + 1);

      const updatedComment: FeedbackComment = {
        ...cmt,
        likes: newLikesCount,
        liked_by: newLikedBy
      };

      // Optimistic update
      setComments(prev => prev.map(c => c.id === cmt.id ? updatedComment : c));

      // Find the protocol row that contains this comment
      const { data } = await supabase
        .from('medicine_protocols')
        .select('*')
        .eq('name', '__APP_FEEDBACK__')
        .limit(50);

      const targetRow = (data || []).find((r: any) =>
        Array.isArray(r.medicines) && r.medicines.some((m: any) => m.id === cmt.id)
      );

      if (targetRow) {
        const updatedList = targetRow.medicines.map((m: any) =>
          m.id === cmt.id ? updatedComment : m
        );
        await supabase
          .from('medicine_protocols')
          .update({ medicines: updatedList })
          .eq('id', targetRow.id);
      }
    } catch (err) {
      console.warn('Could not update reaction:', err);
    }
  };

  // SuperAdmin: Mark as Read (will vanish after 24 hrs)
  const handleMarkAsRead = async (cmt: FeedbackComment) => {
    if (!isSuperAdmin) return;
    try {
      const nowIso = new Date().toISOString();
      const updatedComment: FeedbackComment = {
        ...cmt,
        is_read: true,
        read_at: nowIso
      };

      setComments(prev => prev.map(c => c.id === cmt.id ? updatedComment : c));

      const { data } = await supabase
        .from('medicine_protocols')
        .select('*')
        .eq('name', '__APP_FEEDBACK__')
        .limit(50);

      const targetRow = (data || []).find((r: any) =>
        Array.isArray(r.medicines) && r.medicines.some((m: any) => m.id === cmt.id)
      );

      if (targetRow) {
        const updatedList = targetRow.medicines.map((m: any) =>
          m.id === cmt.id ? updatedComment : m
        );
        await supabase
          .from('medicine_protocols')
          .update({ medicines: updatedList })
          .eq('id', targetRow.id);

        toast.success('Marked as read! This comment will automatically vanish after 24 hours.');
      }
    } catch (err: any) {
      toast.error('Failed to mark as read');
    }
  };

  // SuperAdmin: Delete immediately
  const handleDeleteComment = async (cmt: FeedbackComment) => {
    if (!isSuperAdmin) return;
    try {
      setComments(prev => prev.filter(c => c.id !== cmt.id));

      const { data } = await supabase
        .from('medicine_protocols')
        .select('*')
        .eq('name', '__APP_FEEDBACK__')
        .limit(50);

      const targetRow = (data || []).find((r: any) =>
        Array.isArray(r.medicines) && r.medicines.some((m: any) => m.id === cmt.id)
      );

      if (targetRow) {
        await supabase.from('medicine_protocols').delete().eq('id', targetRow.id);
        toast.success('Comment deleted');
      }
    } catch (err: any) {
      toast.error('Failed to delete comment');
    }
  };

  // Helper formatting for formatting buttons
  const applyFormatting = (tag: string) => {
    setSelectedFormat(prev => (prev === tag ? null : tag));
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = replyText;
    const selected = text.substring(start, end);

    let prefix = '';
    let suffix = '';
    if (tag === 'bold') { prefix = '**'; suffix = '**'; }
    else if (tag === 'italic') { prefix = '*'; suffix = '*'; }
    else if (tag === 'underline') { prefix = '__'; suffix = '__'; }
    else if (tag === 'strikethrough') { prefix = '~~'; suffix = '~~'; }
    else if (tag === 'quote') { prefix = '> '; suffix = ''; }

    const replacement = prefix + (selected || 'text') + suffix;
    const nextText = text.substring(0, start) + replacement + text.substring(end);
    setReplyText(nextText);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getRemainingHours = (readAtStr: string | null | undefined) => {
    if (!readAtStr) return 24;
    const diff = 24 * 60 * 60 * 1000 - (Date.now() - new Date(readAtStr).getTime());
    const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    return hours;
  };

  return (
    <div className="feedback-comments-wrapper flex flex-col items-center justify-center py-6 px-3">
      {/* Informative Banner */}
      <div className="w-full max-w-[450px] mb-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 backdrop-blur-sm shadow-xs">
        <div className="flex items-center gap-2 text-primary font-bold text-xs">
          <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
          <span>Feedback & Comments</span>
          {isSuperAdmin && (
            <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
              SuperAdmin View
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          {isSuperAdmin
            ? 'You are viewing all feedback submissions across clinics. Marking as read automatically vanishes them after 24 hours.'
            : 'Share your thoughts, feature requests, or praise. Comments are delivered directly and privately to the SuperAdmin.'}
        </p>
      </div>

      {/* Styled UI Verse Card */}
      <div className="card">
        <div className="title flex items-center justify-between pr-4">
          <span>Comments {comments.length > 0 && `(${comments.length})`}</span>
          <button
            type="button"
            onClick={fetchComments}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            title="Refresh comments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Comments Feed */}
        <div className="comments-stream max-h-[460px] overflow-y-auto">
          {comments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <MessageSquare className="w-8 h-8 text-slate-300 stroke-1" />
              <p className="text-xs font-semibold">No feedback comments yet.</p>
              <p className="text-[10px] text-slate-400">Be the first to share your thoughts below!</p>
            </div>
          ) : (
            comments.map((cmt) => {
              const userHasLiked = Boolean(user && (cmt.liked_by || []).includes(user.id));
              return (
                <div key={cmt.id} className="comments border-b border-slate-100 last:border-b-0">
                  {/* Left React Column */}
                  <div className="comment-react">
                    <button
                      type="button"
                      onClick={() => handleLike(cmt)}
                      title="Heart this comment"
                      className={userHasLiked ? 'liked' : ''}
                    >
                      <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                        <path
                          fill={userHasLiked ? '#f5356e' : '#707277'}
                          strokeLinecap="round"
                          strokeWidth="2"
                          stroke={userHasLiked ? '#f5356e' : '#707277'}
                          d="M19.4626 3.99415C16.7809 2.34923 14.4404 3.01211 13.0344 4.06801C12.4578 4.50096 12.1696 4.71743 12 4.71743C11.8304 4.71743 11.5422 4.50096 10.9656 4.06801C9.55962 3.01211 7.21909 2.34923 4.53744 3.99415C1.01807 6.15294 0.221721 13.2749 8.33953 19.2834C9.88572 20.4278 10.6588 21 12 21C13.3412 21 14.1143 20.4278 15.6605 19.2834C23.7783 13.2749 22.9819 6.15294 19.4626 3.99415Z"
                        />
                      </svg>
                    </button>
                    <hr />
                    <span>{cmt.likes || 0}</span>
                  </div>

                  {/* Comment Details */}
                  <div className="comment-container">
                    <div className="user">
                      <div className="user-pic">
                        <svg fill="none" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                          <path
                            strokeLinejoin="round"
                            fill="#707277"
                            strokeLinecap="round"
                            strokeWidth="2"
                            stroke="#707277"
                            d="M6.57757 15.4816C5.1628 16.324 1.45336 18.0441 3.71266 20.1966C4.81631 21.248 6.04549 22 7.59087 22H16.4091C17.9545 22 19.1837 21.248 20.2873 20.1966C22.5466 18.0441 18.8372 16.324 17.4224 15.4816C14.1048 13.5061 9.89519 13.5061 6.57757 15.4816Z"
                          />
                          <path
                            strokeWidth="2"
                            fill="#707277"
                            stroke="#707277"
                            d="M16.5 6.5C16.5 8.98528 14.4853 11 12 11C9.51472 11 7.5 8.98528 7.5 6.5C7.5 4.01472 9.51472 2 12 2C14.4853 2 16.5 4.01472 16.5 6.5Z"
                          />
                        </svg>
                      </div>
                      <div className="user-info">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{cmt.author_name}</span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                            {cmt.author_role}
                          </span>
                          {cmt.clinic_name && (
                            <span className="text-[9px] font-semibold text-blue-600">
                              • {cmt.clinic_name}
                            </span>
                          )}
                        </div>
                        <p>{formatDate(cmt.created_at)}</p>
                      </div>
                    </div>

                    <p className="comment-content whitespace-pre-wrap">{cmt.content}</p>

                    {/* SuperAdmin Actions */}
                    {isSuperAdmin && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {!cmt.is_read ? (
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(cmt)}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark as Read</span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" />
                            <span>Vanishing in ~{getRemainingHours(cmt.read_at)}h</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteComment(cmt)}
                          className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700 ml-auto transition-colors"
                          title="Delete now"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Input Text Box */}
        <div className="text-box">
          <div className="box-container">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write feedback about Prescripto..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
            />
            <div>
              <div className="formatting">
                {/* Bold */}
                <button
                  type="button"
                  title="Bold"
                  onClick={() => applyFormatting('bold')}
                >
                  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M5 6C5 4.58579 5 3.87868 5.43934 3.43934C5.87868 3 6.58579 3 8 3H12.5789C15.0206 3 17 5.01472 17 7.5C17 9.98528 15.0206 12 12.5789 12H5V6Z" clipRule="evenodd" fillRule="evenodd" />
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M12.4286 12H13.6667C16.0599 12 18 14.0147 18 16.5C18 18.9853 16.0599 21 13.6667 21H8C6.58579 21 5.87868 21 5.43934 20.5607C5 20.1213 5 19.4142 5 18V12" />
                  </svg>
                </button>

                {/* Italic */}
                <button
                  type="button"
                  title="Italic"
                  onClick={() => applyFormatting('italic')}
                >
                  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M12 4H19" />
                    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M8 20L16 4" />
                    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M5 20H12" />
                  </svg>
                </button>

                {/* Underline */}
                <button
                  type="button"
                  title="Underline"
                  onClick={() => applyFormatting('underline')}
                >
                  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M5.5 3V11.5C5.5 15.0899 8.41015 18 12 18C15.5899 18 18.5 15.0899 18.5 11.5V3" />
                    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M3 21H21" />
                  </svg>
                </button>

                {/* Strikethrough */}
                <button
                  type="button"
                  title="Strikethrough"
                  onClick={() => applyFormatting('strikethrough')}
                >
                  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M4 12H20" />
                    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M17.5 7.66667C17.5 5.08934 15.0376 3 12 3C8.96243 3 6.5 5.08934 6.5 7.66667C6.5 8.15279 6.55336 8.59783 6.6668 9M6 16.3333C6 18.9107 8.68629 21 12 21C15.3137 21 18 19.6667 18 16.3333C18 13.9404 16.9693 12.5782 14.9079 12" />
                  </svg>
                </button>

                {/* Emoji / Smile */}
                <button
                  type="button"
                  title="Insert Smiley"
                  onClick={() => setReplyText(prev => prev + ' 😊')}
                >
                  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                    <circle strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" r="10" cy="12" cx="12" />
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M8 15C8.91212 16.2144 10.3643 17 12 17C13.6357 17 15.0879 16.2144 16 15" />
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke="#707277" d="M8.00897 9L8 9M16 9L15.991 9" />
                  </svg>
                </button>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleSendComment()}
                  disabled={submitting || !replyText.trim()}
                  className="send disabled:opacity-50"
                  title="Send Feedback"
                >
                  <svg fill="none" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#ffffff" d="M12 5L12 20" />
                    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#ffffff" d="M7 9L11.2929 4.70711C11.6262 4.37377 11.7929 4.20711 12 4.20711C12.2071 4.20711 12.3738 4.37377 12.7071 4.70711L17 9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
