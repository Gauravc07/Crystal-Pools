import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Calendar, Check, Clock, Link2, User } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { fetchPost, fetchRelated, formatPostDate, postImage, readingMinutes, resolveRedirect } from '../lib/blog';
import type { Post, PostSummary } from '../lib/blog';
import { sanitizeHtml } from '../lib/sanitize';
import { PostCard } from './Blog';
import NotFound from './NotFound';

type State =
  | { kind: 'loading' }
  | { kind: 'found'; post: Post }
  | { kind: 'redirect'; slug: string }
  | { kind: 'missing' };

function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };
  const btn = 'inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-brand-blue hover:text-brand-blue dark:hover:border-[#38bdf8] dark:hover:text-[#38bdf8] transition-colors';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-500 dark:text-slate-400">Share:</span>
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className={btn} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <button className={btn} onClick={copy}>
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />} {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

export default function BlogPost() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [related, setRelated] = useState<PostSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    setRelated([]);
    (async () => {
      try {
        const post = await fetchPost(slug);
        if (cancelled) return;
        if (post) {
          setState({ kind: 'found', post });
          fetchRelated(post).then(r => !cancelled && setRelated(r));
          return;
        }
        const newSlug = await resolveRedirect(slug);
        if (!cancelled) setState(newSlug ? { kind: 'redirect', slug: newSlug } : { kind: 'missing' });
      } catch {
        if (!cancelled) setState({ kind: 'missing' });
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const post = state.kind === 'found' ? state.post : null;
  const html = useMemo(() => (post ? sanitizeHtml(post.content) : ''), [post]);

  usePageMeta(
    post ? post.meta_title || post.title : 'Blog',
    post ? post.meta_description || post.excerpt : 'Insights from the Crystal Pools team.',
    post ? postImage(post.og_image ?? post.featured_image) : null,
  );

  if (state.kind === 'redirect') return <Navigate to={`/blogs/${state.slug}`} replace />;
  if (state.kind === 'missing') return <NotFound />;

  if (!post) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg pt-40 px-6">
        <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-14 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-64 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="aspect-video rounded-3xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  const image = postImage(post.featured_image);

  return (
    <div className="bg-light-bg dark:bg-dark-bg min-h-screen transition-colors duration-500 font-sans">
      <article>
        <header className="pt-32 md:pt-40 px-6 lg:px-12">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6" aria-label="Breadcrumb">
                <Link to="/blogs" className="inline-flex items-center gap-1.5 hover:text-brand-blue dark:hover:text-[#38bdf8]">
                  <ArrowLeft className="w-4 h-4" /> Blog
                </Link>
                {post.category && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="px-3 py-1 bg-brand-blue/10 text-brand-blue dark:bg-[#38bdf8]/10 dark:text-white text-xs font-bold uppercase tracking-widest rounded-full">
                      {post.category.name}
                    </span>
                  </>
                )}
              </nav>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-slate-900 dark:text-white leading-tight tracking-tight">
                {post.title}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5"><Calendar className="w-4 h-4" />{formatPostDate(post.published_at)}</span>
                {post.author_name && <span className="inline-flex items-center gap-1.5"><User className="w-4 h-4" />{post.author_name}</span>}
                <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" />{readingMinutes(post.content)} min read</span>
              </div>
            </motion.div>
          </div>
        </header>

        {image && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-5xl mx-auto px-6 lg:px-12 mt-10 md:mt-14"
          >
            <img src={image} alt={post.title} className="w-full aspect-video object-cover rounded-4xl" />
          </motion.div>
        )}

        <div className="max-w-3xl mx-auto px-6 lg:px-12 py-12 md:py-16">
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: html }} />

          {post.tags.length > 0 && (
            <ul className="mt-12 flex flex-wrap gap-2" aria-label="Tags">
              {post.tags.map(tag => (
                <li key={tag} className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300">#{tag}</li>
              ))}
            </ul>
          )}

          <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
            <ShareButtons title={post.title} />
          </div>
        </div>
      </article>

      {/* Call to action */}
      <section className="px-6 lg:px-12">
        <div className="max-w-5xl mx-auto rounded-4xl bg-brand-blue dark:bg-[#0f1724] dark:border dark:border-slate-800 px-8 py-12 md:px-14 md:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-medium text-white">Planning a pool?</h2>
            <p className="mt-2 text-white/80 font-light">Talk to our team about design, construction and maintenance.</p>
          </div>
          <Link
            to="/contact-swimming-pool-contractor"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-white text-brand-blue font-semibold hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Get a free quote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {related.length > 0 && (
        <section className="py-16 md:py-24 px-6 lg:px-12 max-w-350 mx-auto">
          <h2 className="text-3xl md:text-4xl font-display font-medium text-slate-900 dark:text-white mb-10">Related articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {related.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </section>
      )}
      {related.length === 0 && <div className="h-16 md:h-24" />}
    </div>
  );
}
