'use client';

import { FormEvent, useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { type JobRecord, type PlatformValue } from '@packages/shared';
import type { Session } from '@supabase/supabase-js';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getSupabaseBrowserClient } from '../lib/supabase-browser';

const sections = [
  'Jobs', 'Published', 'Analytics', 'Campaigns',
  'AI Chat', 'Images', 'TTS', 'Writer', 'Prompts',
  'Platforms', 'Teams', 'Fine-tune',
  'Billing', 'Settings', 'Admin',
];
const platforms: PlatformValue[] = ['TikTok', 'Facebook', 'Instagram', 'YouTube', 'X', 'LinkedIn'];

type UploadTicket =
  | {
      mode: 'local-fallback';
      uploadId: string;
      bucket: string;
      objectPath: string;
    }
  | {
      mode: 'supabase-signed';
      bucket: string;
      objectPath: string;
      token: string;
      path: string;
      signedUploadPath: string;
    };

type PublishedPost = {
  id: string;
  userId: string;
  jobId: string;
  platforms: string[];
  status: 'scheduled' | 'published';
  scheduleAt?: string;
  createdAt: string;
};

type Campaign = {
  id: string;
  userId: string;
  postId: string;
  budget: number;
  durationDays: number;
  objective: 'REACH' | 'VIDEO_VIEWS';
  createdAt: string;
};

type AnalyticsPoint = {
  id: string;
  platform: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  reach: number;
  capturedAt: string;
};

type AnalyticsSummary = {
  totalJobs: number;
  totalPosts: number;
  totalCampaigns: number;
  totalSpend: number;
  queuedJobs: number;
  publishedJobs: number;
};

type PlatformTokenInfo = {
  platform: string;
  expiresAt: string | null;
};

type SubscriptionSnapshot = {
  plan: string;
  status: string;
  credits: number;
  quota: {
    limit: number | null;
    used: number;
    remaining: number | null;
  };
};

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productDescription, setProductDescription] = useState('');
  const [tone, setTone] = useState('Confident and product-focused');
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformValue[]>(['TikTok', 'Facebook']);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsPostId, setAnalyticsPostId] = useState<string | null>(null);
  const [analyticsPoints, setAnalyticsPoints] = useState<AnalyticsPoint[]>([]);
  const [connectedTokens, setConnectedTokens] = useState<PlatformTokenInfo[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState('Jobs');
  const [submitting, setSubmitting] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // SSE + live job status
  const [watchedJobId, setWatchedJobId] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ jobId: string; status: string } | null>(null);

  // Ad preview panel
  const [previewJob, setPreviewJob] = useState<JobRecord | null>(null);
  const [editCaption, setEditCaption] = useState('');

  // Convert Supabase storage path → public URL
  function storageUrl(path?: string): string | undefined {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    return `${base}/storage/v1/object/public/${path}`;
  }

  // Boost modal
  const [boostTarget, setBoostTarget] = useState<PublishedPost | null>(null);
  const [boostBudget, setBoostBudget] = useState('50');
  const [boostDays, setBoostDays] = useState('7');
  const [boostObjective, setBoostObjective] = useState<'REACH' | 'VIDEO_VIEWS'>('VIDEO_VIEWS');

  // Per-post analytics detail modal
  const [postDetailPost, setPostDetailPost] = useState<PublishedPost | null>(null);
  const [postDetailPoints, setPostDetailPoints] = useState<AnalyticsPoint[]>([]);
  const [postDetailTab, setPostDetailTab] = useState<string>('');
  const [postDetailLoading, setPostDetailLoading] = useState(false);

  // Credit balance
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [addCreditAmount, setAddCreditAmount] = useState('50');
  const [addCreditBusy, setAddCreditBusy] = useState(false);

  // Settings sub-tabs
  const [settingsTab, setSettingsTab] = useState<'account' | 'notifications' | 'danger'>('account');
  const [notifyEmail, setNotifyEmail] = useState(true);

  // Onboarding wizard
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // ── AI Chat ─────────────────────────────────────────────────────────────────
  const [chats, setChats] = useState<{id:string;title:string;engine:string;model:string;updated_at:string}[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{id:string;role:string;content:string;created_at:string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatEngine, setChatEngine] = useState('openai');
  const [chatModel, setChatModel] = useState('gpt-4o-mini');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // ── Image Generation ─────────────────────────────────────────────────────────
  const [imgEngine, setImgEngine] = useState<'openai'|'fal_ai'|'novita'|'freepik'>('openai');
  const [imgModel, setImgModel] = useState('dall-e-3');
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgNeg, setImgNeg] = useState('');
  const [imgSize, setImgSize] = useState<'1024x1024'|'1024x1792'|'1792x1024'>('1024x1024');
  const [imgQuality, setImgQuality] = useState<'standard'|'hd'>('standard');
  const [imgN, setImgN] = useState(1);
  const [imgBusy, setImgBusy] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{id:string;image_url:string;prompt:string;engine:string;created_at:string}[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const [ttsEngine, setTtsEngine] = useState<'openai'|'elevenlabs'|'speechify'>('openai');
  const [ttsVoice, setTtsVoice] = useState('alloy');
  const [ttsModel, setTtsModel] = useState('tts-1-hd');
  const [ttsText, setTtsText] = useState('');
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsHistory, setTtsHistory] = useState<{id:string;audio_url:string;text_input:string;engine:string;created_at:string}[]>([]);
  const [ttsLoading, setTtsLoading] = useState(false);

  // ── Content Writer ────────────────────────────────────────────────────────────
  const [writerType, setWriterType] = useState('article');
  const [writerTitle, setWriterTitle] = useState('');
  const [writerTopic, setWriterTopic] = useState('');
  const [writerTone, setWriterTone] = useState('professional');
  const [writerWords, setWriterWords] = useState(500);
  const [writerKeywords, setWriterKeywords] = useState('');
  const [writerEngine, setWriterEngine] = useState('openai');
  const [writerModel, setWriterModel] = useState('gpt-4o-mini');
  const [writerBusy, setWriterBusy] = useState(false);
  const [writerOutput, setWriterOutput] = useState('');
  const [writerDocs, setWriterDocs] = useState<{id:string;title:string;type:string;words:number;created_at:string}[]>([]);

  // ── Prompt Templates ─────────────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<{id:string;title:string;description:string;prompt:string;category:string;use_count:number}[]>([]);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptBody, setPromptBody] = useState('');
  const [promptCategory, setPromptCategory] = useState('general');
  const [promptPublic, setPromptPublic] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptsLoading, setPromptsLoading] = useState(false);

  // ── Teams ─────────────────────────────────────────────────────────────────────
  const [teams, setTeams] = useState<{id:string;name:string;slug:string;myRole:string}[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamsBusy, setTeamsBusy] = useState(false);

  // ── Fine-tuning ──────────────────────────────────────────────────────────────
  const [ftJobs, setFtJobs] = useState<{id:string;base_model:string;status:string;fine_tuned_model:string|null;created_at:string}[]>([]);
  const [ftBaseModel, setFtBaseModel] = useState('gpt-4o-mini-2024-07-18');
  const [ftFileId, setFtFileId] = useState('');
  const [ftEpochs, setFtEpochs] = useState(3);
  const [ftBusy, setFtBusy] = useState(false);

  // ── Admin ─────────────────────────────────────────────────────────────────────
  const [adminUsers, setAdminUsers] = useState<{id:string;email:string;name:string;role:string;createdAt:string;subscription:{plan:string}|null}[]>([]);
  const [adminStats, setAdminStats] = useState<{totalUsers:number;totalChats:number;totalImages:number;totalTts:number;totalContent:number;creditsLast30d:number}|null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSettings, setAdminSettings] = useState<{key:string;value:string;isSecret:boolean}[]>([]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // SSE: watch a job for live status updates
  useEffect(() => {
    if (!watchedJobId) {
      return;
    }

    if (sseRef.current) {
      sseRef.current.close();
    }

    getAuthHeaders().then((headers) => {
      // EventSource doesn't support custom headers; pass token as query param
      const token = (headers as Record<string, string>)['Authorization']?.replace('Bearer ', '') ?? '';
      const url = `/api/v1/jobs/${watchedJobId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const es = new EventSource(url);
      sseRef.current = es;

      es.addEventListener('status', (ev: MessageEvent) => {
        const data = JSON.parse(ev.data) as { jobId: string; status: string; job: JobRecord };
        setStatusBanner({ jobId: data.jobId, status: data.status });
        setJobs((prev) => prev.map((j) => (j.id === data.jobId ? data.job : j)));

        if (data.status === 'awaiting_approval') {
          setPreviewJob(data.job);
          setEditCaption(data.job.productDescription ?? '');
        }

        if (data.status === 'published' || data.status === 'failed') {
          setWatchedJobId(null);
          setTimeout(() => setStatusBanner(null), 5000);
        }
      });

      es.addEventListener('timeout', () => {
        setWatchedJobId(null);
        es.close();
      });

      es.onerror = () => {
        setWatchedJobId(null);
        es.close();
      };
    }).catch(() => { /* no-op */ });

    return () => {
      sseRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedJobId]);

  const personSourceType = useMemo(() => {
    if (!personFile) {
      return undefined;
    }
    return personFile.type.startsWith('video/') ? 'video' : 'photo';
  }, [personFile]);

  async function getAuthHeaders() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return {} as HeadersInit;
    }

    const {
      data: { session: liveSession }
    } = await client.auth.getSession();

    const token = liveSession?.access_token;
    if (!token) {
      return {} as HeadersInit;
    }

    return { Authorization: `Bearer ${token}` } as HeadersInit;
  }

  async function fetchJobs() {
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/v1/jobs', { headers: authHeaders });

    if (response.status === 401) {
      setJobs([]);
      setInfo('Sign in to load your jobs.');
      return;
    }

    const data = (await response.json()) as { jobs: JobRecord[] };
    setJobs(data.jobs || []);
  }

  async function fetchPublishedPosts() {
    const response = await fetch('/api/v1/posts', { headers: await getAuthHeaders() });
    if (!response.ok) {
      if (response.status !== 401) {
        setError('Could not load published posts.');
      }
      setPublishedPosts([]);
      return;
    }

    const data = (await response.json()) as { posts: PublishedPost[] };
    setPublishedPosts(data.posts || []);
  }

  async function fetchCampaigns() {
    const response = await fetch('/api/v1/campaigns', { headers: await getAuthHeaders() });
    if (!response.ok) {
      if (response.status !== 401) {
        setError('Could not load campaigns.');
      }
      setCampaigns([]);
      return;
    }

    const data = (await response.json()) as { campaigns: Campaign[] };
    setCampaigns(data.campaigns || []);
  }

  async function fetchAnalyticsSummary() {
    const response = await fetch('/api/v1/analytics/summary', { headers: await getAuthHeaders() });
    if (!response.ok) {
      if (response.status !== 401) {
        setError('Could not load analytics summary.');
      }
      setSummary(null);
      return;
    }

    const data = (await response.json()) as AnalyticsSummary;
    setSummary(data);
  }

  async function fetchConnectedTokens() {
    const response = await fetch('/api/v1/platforms/tokens', { headers: await getAuthHeaders() });
    if (!response.ok) {
      setConnectedTokens([]);
      return;
    }
    const data = (await response.json()) as { tokens: PlatformTokenInfo[] };
    setConnectedTokens(data.tokens || []);
  }

  async function fetchSubscription() {
    const response = await fetch('/api/v1/billing/subscription', { headers: await getAuthHeaders() });
    if (!response.ok) {
      setSubscription(null);
      return;
    }
    const data = (await response.json()) as SubscriptionSnapshot;
    setSubscription(data);
  }

  async function fetchCreditBalance() {
    const response = await fetch('/api/v1/billing/credits', { headers: await getAuthHeaders() });
    if (!response.ok) return;
    const data = (await response.json()) as { creditBalance: number };
    setCreditBalance(data.creditBalance);
  }

  async function loadPostDetail(post: PublishedPost) {
    setPostDetailPost(post);
    setPostDetailPoints([]);
    setPostDetailLoading(true);
    try {
      const response = await fetch(`/api/v1/analytics/posts/${post.id}`, {
        headers: await getAuthHeaders()
      });
      if (response.ok) {
        const data = (await response.json()) as { points: AnalyticsPoint[] };
        setPostDetailPoints(data.points ?? []);
        if (data.points?.length) {
          setPostDetailTab(data.points[0].platform);
        }
      }
    } finally {
      setPostDetailLoading(false);
    }
  }

  async function disconnectPlatform(platformName: string) {
    setWorking(true);
    setError(null);
    const response = await fetch(`/api/v1/platforms/tokens/${platformName.toLowerCase()}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    });
    setWorking(false);
    if (!response.ok) {
      setError(`Could not disconnect ${platformName}.`);
      return;
    }
    setInfo(`${platformName} disconnected.`);
    await fetchConnectedTokens();
  }

  async function refreshDashboardData() {
    await Promise.all([
      fetchJobs(),
      fetchPublishedPosts(),
      fetchCampaigns(),
      fetchAnalyticsSummary(),
      fetchConnectedTokens(),
      fetchSubscription(),
      fetchCreditBalance()
    ]);
  }

  useEffect(() => {
    if (!session) return;
    refreshDashboardData().catch(() => {
      setError('Could not load jobs list.');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Onboarding: show wizard on first login if no platforms connected
  useEffect(() => {
    if (!session) return;
    const key = `onboarded_${session.user.id}`;
    if (typeof window !== 'undefined' && !localStorage.getItem(key) && connectedTokens.length === 0) {
      setShowOnboarding(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Auto-load AI feature data when switching to the relevant section
  useEffect(() => {
    if (!session) return;
    switch (activeSection) {
      case 'AI Chat':   if (chats.length === 0)          void loadChats();         break;
      case 'Images':    if (generatedImages.length === 0) void loadImages();        break;
      case 'TTS':       if (ttsHistory.length === 0)      void loadTtsHistory();    break;
      case 'Writer':    if (writerDocs.length === 0)      void loadWriterDocs();    break;
      case 'Prompts':   if (prompts.length === 0)         void loadPrompts();       break;
      case 'Teams':     if (teams.length === 0)           void loadTeams();         break;
      case 'Fine-tune': if (ftJobs.length === 0)          void loadFineTunes();     break;
    }
  // We intentionally only re-run when the section changes, not on every state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, session]);

  async function uploadWithTicket(ticket: UploadTicket, file: File) {
    if (ticket.mode === 'local-fallback') {
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error('Supabase browser client is not configured.');
    }

    const { error: uploadError } = await client.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file);

    if (uploadError) {
      throw uploadError;
    }
  }

  async function signInWithEmail() {
    setError(null);
    setInfo(null);
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError('Supabase public keys are not configured in environment variables.');
      return;
    }

    if (!authEmail.trim()) {
      setError('Enter an email to sign in.');
      return;
    }

    setAuthBusy(true);
    const { error: signInError } = await client.auth.signInWithOtp({ email: authEmail.trim() });
    setAuthBusy(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setInfo('Magic link sent. Check your email to complete sign in.');
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    await client.auth.signOut();
    setJobs([]);
    setPublishedPosts([]);
    setCampaigns([]);
    setSummary(null);
    setAnalyticsPoints([]);
    setAnalyticsPostId(null);
    setConnectedTokens([]);
    setSubscription(null);
    setInfo('Signed out.');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!personFile) {
      setError('Please upload a person photo or video.');
      return;
    }

    if (!productFile && !productDescription.trim()) {
      setError('Please add a product photo or write a product description.');
      return;
    }

    const allowedPersonMime = [
      'video/mp4',
      'video/quicktime',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedPersonMime.includes(personFile.type)) {
      setError('Person input must be MP4/MOV or JPG/PNG/WEBP.');
      return;
    }

    if (personSourceType === 'video' && personFile.size > 500 * 1024 * 1024) {
      setError('Person video must be 500MB or less.');
      return;
    }

    if (personSourceType === 'photo' && personFile.size > 20 * 1024 * 1024) {
      setError('Person photo must be 20MB or less.');
      return;
    }

    if (productFile) {
      const allowedProductMime = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedProductMime.includes(productFile.type)) {
        setError('Product photo must be JPG/PNG/WEBP.');
        return;
      }
      if (productFile.size > 20 * 1024 * 1024) {
        setError('Product photo must be 20MB or less.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const personUploadResponse = await fetch('/api/v1/uploads/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({
          kind: personSourceType === 'video' ? 'person_video' : 'person_photo',
          fileName: personFile.name
        })
      });

      if (!personUploadResponse.ok) {
        setError('Could not create person upload ticket.');
        return;
      }

      const personTicket = (await personUploadResponse.json()) as UploadTicket;
      await uploadWithTicket(personTicket, personFile);
      let productTicket: UploadTicket | null = null;

      if (productFile) {
        const productUploadResponse = await fetch('/api/v1/uploads/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders())
          },
          body: JSON.stringify({ kind: 'product_photo', fileName: productFile.name })
        });

        if (!productUploadResponse.ok) {
          setError('Could not create product upload ticket.');
          return;
        }

        productTicket = (await productUploadResponse.json()) as UploadTicket;
        await uploadWithTicket(productTicket, productFile);
      }

      const response = await fetch('/api/v1/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({
          personSourceType,
          personSourceName: personFile.name,
          personSourceUrl: `${personTicket.bucket}/${personTicket.objectPath}`,
          productPhotoName: productFile?.name,
          productPhotoUrl: productTicket
            ? `${productTicket.bucket}/${productTicket.objectPath}`
            : undefined,
          productDescription: productDescription.trim() || undefined,
          tone: tone.trim() || undefined,
          targetPlatforms: selectedPlatforms
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in before creating a job.');
          return;
        }

        if (response.status === 402) {
          setError('Plan quota reached. Upgrade your plan to create more jobs.');
          return;
        }

        const apiError = (await response.json()) as { error?: string };
        setError(apiError.error || 'Could not create job.');
        return;
      }

      setPersonFile(null);
      setProductFile(null);
      setProductDescription('');
      const created = (await response.json()) as { job: JobRecord };
      setInfo('Job created. Processing started.');
      setWatchedJobId(created.job.id);
      await refreshDashboardData();
    } catch {
      setError('Failed to submit job.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(jobId: string, action: 'approve' | 'regenerate') {
    setError(null);
    const response = await fetch(`/api/v1/jobs/${jobId}/${action}`, {
      method: 'POST',
      headers: await getAuthHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        setError('Please sign in before changing job status.');
        return;
      }
      setError(`Could not ${action} this job.`);
      return;
    }
    await refreshDashboardData();
  }

  async function publishJob(job: JobRecord) {
    setWorking(true);
    setError(null);

    const response = await fetch('/api/v1/posts/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders())
      },
      body: JSON.stringify({
        jobId: job.id,
        platforms: job.targetPlatforms.length ? job.targetPlatforms : ['TikTok']
      })
    });

    setWorking(false);

    if (!response.ok) {
      setError('Could not publish this job.');
      return;
    }

    setInfo('Post created from selected job.');
    await refreshDashboardData();
  }

  async function boostPost(post: PublishedPost) {
    setBoostTarget(post);
    setBoostBudget('50');
    setBoostDays('7');
    setBoostObjective('VIDEO_VIEWS');
  }

  async function submitBoost() {
    if (!boostTarget) return;
    setWorking(true);
    setError(null);

    const response = await fetch(`/api/v1/posts/${boostTarget.id}/boost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders())
      },
      body: JSON.stringify({
        budget: Number(boostBudget),
        durationDays: Number(boostDays),
        objective: boostObjective
      })
    });

    setWorking(false);

    if (!response.ok) {
      setError('Could not create boost campaign.');
      return;
    }

    setBoostTarget(null);
    setInfo('Boost campaign created.');
    await refreshDashboardData();
  }

  async function handleAddCredits() {
    setAddCreditBusy(true);
    setError(null);
    const response = await fetch('/api/v1/billing/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ amount: Number(addCreditAmount) })
    });
    setAddCreditBusy(false);
    if (!response.ok) {
      setError('Could not create credit checkout.');
      return;
    }
    const data = (await response.json()) as { url: string };
    if (data.url) window.location.href = data.url;
  }

  // ── AI Chat ─────────────────────────────────────────────────────────────────
  async function loadChats() {
    setChatLoading(true);
    const r = await fetch('/api/v1/ai/chat', { headers: await getAuthHeaders() });
    if (r.ok) setChats(await r.json() as typeof chats);
    setChatLoading(false);
  }

  async function createChat() {
    setChatBusy(true);
    const r = await fetch('/api/v1/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ engine: chatEngine, model: chatModel }),
    });
    if (r.ok) {
      const chat = (await r.json()) as { id: string; title: string; engine: string; model: string; updated_at: string };
      setChats((prev) => [chat, ...prev]);
      setActiveChatId(chat.id);
      setChatMessages([]);
    }
    setChatBusy(false);
  }

  async function openChat(chatId: string) {
    setActiveChatId(chatId);
    setChatMessages([]);
    const r = await fetch(`/api/v1/ai/chat/${chatId}/messages`, { headers: await getAuthHeaders() });
    if (r.ok) setChatMessages(await r.json() as typeof chatMessages);
  }

  async function sendChatMessage() {
    if (!activeChatId || !chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg, created_at: new Date().toISOString() }]);
    setStreamingContent('');
    setChatBusy(true);

    const r = await fetch(`/api/v1/ai/chat/${activeChatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ content: userMsg, stream: true }),
    });

    if (!r.ok || !r.body) { setChatBusy(false); return; }

    let full = '';
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split('\n')) {
        const t = line.replace(/^data:\s*/, '').trim();
        if (!t || t === '[DONE]') continue;
        try {
          const json = JSON.parse(t);
          full += json.choices?.[0]?.delta?.content ?? '';
          if (json.type === 'content_block_delta') full += json.delta?.text ?? '';
          if (json.candidates) full += json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          setStreamingContent(full);
        } catch { /* skip */ }
      }
    }
    setStreamingContent('');
    setChatMessages((prev) => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: full, created_at: new Date().toISOString() }]);
    setChatBusy(false);
  }

  // ── Image Generation ─────────────────────────────────────────────────────────
  async function loadImages() {
    setImagesLoading(true);
    const r = await fetch('/api/v1/ai/images', { headers: await getAuthHeaders() });
    if (r.ok) {
      const d = (await r.json()) as { data: typeof generatedImages };
      setGeneratedImages(d.data ?? []);
    }
    setImagesLoading(false);
  }

  async function generateImage() {
    if (!imgPrompt.trim()) return;
    setImgBusy(true);
    setError(null);
    const r = await fetch('/api/v1/ai/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({
        engine: imgEngine, model: imgModel, prompt: imgPrompt,
        negativePrompt: imgNeg, size: imgSize, quality: imgQuality, n: imgN,
      }),
    });
    setImgBusy(false);
    if (!r.ok) { setError('Image generation failed.'); return; }
    const d = (await r.json()) as { images: typeof generatedImages };
    setGeneratedImages((prev) => [...(d.images ?? []), ...prev]);
  }

  // ── TTS ──────────────────────────────────────────────────────────────────────
  async function loadTtsHistory() {
    setTtsLoading(true);
    const r = await fetch('/api/v1/ai/tts', { headers: await getAuthHeaders() });
    if (r.ok) setTtsHistory(await r.json() as typeof ttsHistory);
    setTtsLoading(false);
  }

  async function synthesizeTts() {
    if (!ttsText.trim()) return;
    setTtsBusy(true);
    setError(null);
    const r = await fetch('/api/v1/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ engine: ttsEngine, model: ttsModel, voice: ttsVoice, text: ttsText }),
    });
    setTtsBusy(false);
    if (!r.ok) { setError('TTS synthesis failed.'); return; }
    const saved = (await r.json()) as typeof ttsHistory[0];
    setTtsHistory((prev) => [saved, ...prev]);
  }

  // ── Content Writer ────────────────────────────────────────────────────────────
  async function loadWriterDocs() {
    const r = await fetch('/api/v1/ai/content', { headers: await getAuthHeaders() });
    if (r.ok) setWriterDocs(await r.json() as typeof writerDocs);
  }

  async function generateContent() {
    if (!writerTitle.trim() || !writerTopic.trim()) return;
    setWriterBusy(true);
    setWriterOutput('');
    setError(null);
    const r = await fetch('/api/v1/ai/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({
        type: writerType, title: writerTitle, topic: writerTopic,
        tone: writerTone, wordCount: writerWords,
        keywords: writerKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        engine: writerEngine, model: writerModel,
      }),
    });
    setWriterBusy(false);
    if (!r.ok) { setError('Content generation failed.'); return; }
    const d = (await r.json()) as { content: string; title: string; words: number; id: string; type: string; created_at: string };
    setWriterOutput(d.content);
    setWriterDocs((prev) => [{ id: d.id, title: d.title, type: d.type, words: d.words, created_at: d.created_at }, ...prev]);
  }

  // ── Prompt Templates ──────────────────────────────────────────────────────────
  async function loadPrompts() {
    setPromptsLoading(true);
    const r = await fetch('/api/v1/prompts', { headers: await getAuthHeaders() });
    if (r.ok) setPrompts(await r.json() as typeof prompts);
    setPromptsLoading(false);
  }

  async function savePrompt() {
    if (!promptTitle.trim() || !promptBody.trim()) return;
    setPromptBusy(true);
    const r = await fetch('/api/v1/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ title: promptTitle, prompt: promptBody, category: promptCategory, isPublic: promptPublic }),
    });
    setPromptBusy(false);
    if (r.ok) {
      const d = (await r.json()) as typeof prompts[0];
      setPrompts((prev) => [d, ...prev]);
      setPromptTitle(''); setPromptBody('');
    }
  }

  async function deletePrompt(id: string) {
    await fetch(`/api/v1/prompts/${id}`, { method: 'DELETE', headers: await getAuthHeaders() });
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Teams ─────────────────────────────────────────────────────────────────────
  async function loadTeams() {
    const r = await fetch('/api/v1/teams', { headers: await getAuthHeaders() });
    if (r.ok) setTeams(await r.json() as typeof teams);
  }

  async function createTeam() {
    if (!newTeamName.trim()) return;
    setTeamsBusy(true);
    const r = await fetch('/api/v1/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ name: newTeamName }),
    });
    setTeamsBusy(false);
    if (r.ok) {
      const t = (await r.json()) as typeof teams[0];
      setTeams((prev) => [{ ...t, myRole: 'owner' }, ...prev]);
      setNewTeamName('');
    }
  }

  // ── Fine-tuning ───────────────────────────────────────────────────────────────
  async function loadFineTunes() {
    const r = await fetch('/api/v1/ai/finetune', { headers: await getAuthHeaders() });
    if (r.ok) setFtJobs(await r.json() as typeof ftJobs);
  }

  async function startFineTune() {
    if (!ftFileId.trim()) return;
    setFtBusy(true);
    const r = await fetch('/api/v1/ai/finetune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ baseModel: ftBaseModel, fileId: ftFileId, epochs: ftEpochs }),
    });
    setFtBusy(false);
    if (r.ok) {
      const j = (await r.json()) as typeof ftJobs[0];
      setFtJobs((prev) => [j, ...prev]);
      setFtFileId('');
    }
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────
  async function loadAdminData() {
    setAdminLoading(true);
    const headers = await getAuthHeaders();
    const [usersResp, statsResp, settingsResp] = await Promise.all([
      fetch('/api/v1/admin/users',    { headers }),
      fetch('/api/v1/admin/stats',    { headers }),
      fetch('/api/v1/admin/settings', { headers }),
    ]);
    if (usersResp.ok)    setAdminUsers(await usersResp.json() as typeof adminUsers);
    if (statsResp.ok)    setAdminStats(await statsResp.json() as typeof adminStats);
    if (settingsResp.ok) setAdminSettings(await settingsResp.json() as typeof adminSettings);
    setAdminLoading(false);
  }

  async function syncAnalytics() {
    setWorking(true);
    setError(null);

    const response = await fetch('/api/v1/analytics/sync', {
      method: 'POST',
      headers: await getAuthHeaders()
    });

    setWorking(false);

    if (!response.ok) {
      setError('Could not sync analytics.');
      return;
    }

    setInfo('Analytics sync complete.');
    await refreshDashboardData();
  }

  async function loadPostAnalytics(postId: string) {
    setWorking(true);
    setError(null);
    setAnalyticsPostId(postId);

    const response = await fetch(`/api/v1/analytics/posts/${postId}`, {
      headers: await getAuthHeaders()
    });

    setWorking(false);

    if (!response.ok) {
      setError('Could not load post analytics.');
      setAnalyticsPoints([]);
      return;
    }

    const data = (await response.json()) as { points: AnalyticsPoint[] };
    setAnalyticsPoints(data.points || []);
  }

  async function approveFromPreview() {
    if (!previewJob) return;
    await updateStatus(previewJob.id, 'approve');
    setPreviewJob(null);
  }

  async function regenerateFromPreview() {
    if (!previewJob) return;
    setWatchedJobId(previewJob.id);
    await updateStatus(previewJob.id, 'regenerate');
    setPreviewJob(null);
  }

  function togglePlatform(platform: PlatformValue) {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  return (
    <main className="app-shell">
      {/* Status banner for live job updates */}
      {statusBanner && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
            background: statusBanner.status === 'failed' ? '#ef4444' : statusBanner.status === 'awaiting_approval' ? '#6366f1' : '#0ea5e9',
            color: '#fff', padding: '10px 20px', textAlign: 'center', fontSize: 14
          }}
        >
          Job {statusBanner.jobId.slice(0, 8)}… status: <strong>{statusBanner.status}</strong>
          {statusBanner.status === 'awaiting_approval' && ' — review the preview below'}
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            style={{ marginLeft: 16, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}
          >✕</button>
        </div>
      )}

      {/* Ad preview modal */}
      {previewJob && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '24px 0'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewJob(null); }}
        >
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, maxWidth: 860, width: '92%', border: '1px solid #334155' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0 }}>Job Preview</h2>
                <span style={{
                  padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  background: previewJob.status === 'published' ? '#166534' : previewJob.status === 'awaiting_approval' ? '#3730a3' : previewJob.status === 'processing' ? '#92400e' : '#1e3a5f',
                  color: '#e2e8f0'
                }}>{previewJob.status}</span>
              </div>
              <button type="button" onClick={() => setPreviewJob(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {/* Images row */}
            <div style={{ display: 'grid', gridTemplateColumns: previewJob.productPhotoUrl ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Source */}
              <div>
                <p className="label-title" style={{ margin: '0 0 6px' }}>Source ({previewJob.personSourceType})</p>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>{previewJob.personSourceName}</p>
                {storageUrl(previewJob.personSourceUrl) ? (
                  previewJob.personSourceType === 'video'
                    ? <video src={storageUrl(previewJob.personSourceUrl)} controls style={{ width: '100%', borderRadius: 8 }} />
                    : <img src={storageUrl(previewJob.personSourceUrl)} alt="source" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 200 }} />
                ) : (
                  <div style={{ height: 160, background: '#0f172a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>No file URL</div>
                )}
              </div>

              {/* Product photo (if any) */}
              {previewJob.productPhotoUrl && (
                <div>
                  <p className="label-title" style={{ margin: '0 0 6px' }}>Product Photo</p>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>{previewJob.productPhotoName ?? ''}</p>
                  <img src={storageUrl(previewJob.productPhotoUrl)} alt="product" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 200 }} />
                </div>
              )}

              {/* Generated output */}
              <div>
                <p className="label-title" style={{ margin: '0 0 6px' }}>Generated Ad</p>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>AI output</p>
                {previewJob.generatedVideoUrl ? (
                  <video src={storageUrl(previewJob.generatedVideoUrl)} controls style={{ width: '100%', borderRadius: 8 }} />
                ) : (
                  <div style={{ height: 160, background: '#0f172a', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13, gap: 6 }}>
                    <span>{previewJob.status === 'processing' ? '⏳ Generating…' : previewJob.status === 'failed' ? '❌ Generation failed' : '⏸ Not yet generated'}</span>
                    {previewJob.errorMessage && <span style={{ color: '#f87171', fontSize: 11, textAlign: 'center', padding: '0 8px' }}>{previewJob.errorMessage}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Caption generated by AI */}
            {previewJob.caption && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e3a5f' }}>
                <p className="label-title" style={{ margin: '0 0 4px' }}>AI-Generated Caption</p>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{previewJob.caption}</p>
              </div>
            )}

            {/* Editable caption */}
            <label>
              <span className="label-title">Caption to Publish (editable)</span>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={3}
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Edit caption before publishing…"
              />
            </label>

            {/* Details */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '10px 0 14px', fontSize: 13, color: '#94a3b8' }}>
              {previewJob.tone && <span>Tone: <strong style={{ color: '#cbd5e1' }}>{previewJob.tone}</strong></span>}
              {previewJob.targetPlatforms.length > 0 && <span>Platforms: <strong style={{ color: '#cbd5e1' }}>{previewJob.targetPlatforms.join(', ')}</strong></span>}
              <span>Created: <strong style={{ color: '#cbd5e1' }}>{new Date(previewJob.createdAt).toLocaleString()}</strong></span>
            </div>

            <div className="job-actions">
              <button type="button" className="chip active" onClick={approveFromPreview}>Approve &amp; Queue Publish</button>
              <button type="button" className="chip" onClick={regenerateFromPreview}>Regenerate</button>
              <button type="button" className="chip" onClick={() => setPreviewJob(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Boost modal */}
      {boostTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Boost This Post</h2>
              <button type="button" onClick={() => setBoostTarget(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <p className="subtitle" style={{ marginBottom: 16 }}>Platforms: {boostTarget.platforms.join(', ')}</p>
            <label>
              Budget (USD)
              <input type="number" min="5" max="10000" value={boostBudget} onChange={(e) => setBoostBudget(e.target.value)} />
            </label>
            <label>
              Duration (days)
              <input type="number" min="1" max="90" value={boostDays} onChange={(e) => setBoostDays(e.target.value)} />
            </label>
            <label>
              Objective
              <select value={boostObjective} onChange={(e) => setBoostObjective(e.target.value as 'REACH' | 'VIDEO_VIEWS')}>
                <option value="VIDEO_VIEWS">Video Views</option>
                <option value="REACH">Reach</option>
              </select>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="job-actions" style={{ marginTop: 12 }}>
              <button type="button" className="chip active" onClick={submitBoost} disabled={working}>
                {working ? 'Creating…' : `Boost for $${boostBudget} over ${boostDays} days`}
              </button>
              <button type="button" className="chip" onClick={() => setBoostTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Post analytics detail modal (5.3) */}
      {postDetailPost && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, maxWidth: 720, width: '95%', border: '1px solid #334155', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Post Analytics Detail</h2>
              <button type="button" onClick={() => setPostDetailPost(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <p className="subtitle" style={{ marginBottom: 12 }}>
              Post {postDetailPost.id.slice(0, 8)}… · Platforms: {postDetailPost.platforms.join(', ')} · {new Date(postDetailPost.createdAt).toLocaleDateString()}
            </p>

            {postDetailLoading ? (
              <p className="subtitle">Loading analytics…</p>
            ) : postDetailPoints.length === 0 ? (
              <p className="subtitle">No analytics data found for this post. Sync analytics first.</p>
            ) : (() => {
              // Build platform list from unique platforms in data
              const ptPlatforms = [...new Set(postDetailPoints.map((p) => p.platform))];

              // Aggregate all-time totals per platform
              const byPlatform: Record<string, {
                views: number; likes: number; shares: number;
                comments: number; clicks: number; reach: number; count: number;
              }> = {};
              for (const pt of postDetailPoints) {
                if (!byPlatform[pt.platform]) {
                  byPlatform[pt.platform] = { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, reach: 0, count: 0 };
                }
                const b = byPlatform[pt.platform];
                b.views += pt.views; b.likes += pt.likes; b.shares += pt.shares;
                b.comments += pt.comments; b.clicks += pt.clicks; b.reach += pt.reach; b.count++;
              }

              const activeTab = postDetailTab || ptPlatforms[0];
              const tabData = byPlatform[activeTab];
              const cpm = tabData?.reach > 0
                ? ((campaigns.filter(c => c.postId === postDetailPost.id).reduce((a, c) => a + c.budget, 0) / tabData.reach) * 1000)
                : null;

              const tabPoints = postDetailPoints.filter(p => p.platform === activeTab)
                .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
              const lineData = tabPoints.map(p => ({ date: new Date(p.capturedAt).toLocaleDateString(), views: p.views, reach: p.reach }));

              return (
                <>
                  {/* Platform tabs */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {ptPlatforms.map(pl => (
                      <button key={pl} type="button" className={`chip${activeTab === pl ? ' active' : ''}`} onClick={() => setPostDetailTab(pl)}>
                        {pl}
                      </button>
                    ))}
                  </div>

                  {/* KPI row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'Views', value: tabData?.views ?? 0 },
                      { label: 'Reach', value: tabData?.reach ?? 0 },
                      { label: 'Likes', value: tabData?.likes ?? 0 },
                      { label: 'Shares', value: tabData?.shares ?? 0 },
                      { label: 'Comments', value: tabData?.comments ?? 0 },
                      { label: 'Clicks', value: tabData?.clicks ?? 0 },
                      { label: 'Est. CPM', value: cpm != null ? `$${cpm.toFixed(2)}` : '—' }
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#6366f1' }}>{value.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Views + reach line chart */}
                  {lineData.length > 1 && (
                    <div style={{ marginBottom: 8 }}>
                      <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 8 }}>Views &amp; Reach Over Time</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={lineData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }} />
                          <Legend />
                          <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="reach" stroke="#22d3ee" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="job-actions" style={{ marginTop: 12 }}>
              <a
                href={`/api/v1/analytics/export`}
                className="chip"
                style={{ textDecoration: 'none' }}
                download
              >
                Export CSV
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding wizard (6.4) */}
      {showOnboarding && session && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, maxWidth: 520, width: '90%', border: '1px solid #334155', textAlign: 'center' }}>
            {/* Step indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {['Welcome', 'Platforms', 'Done'].map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i <= onboardingStep ? '#6366f1' : '#334155',
                    color: i <= onboardingStep ? '#fff' : '#94a3b8',
                    fontSize: 13, fontWeight: 700
                  }}>{i + 1}</div>
                  {i < 2 && <div style={{ width: 32, height: 2, background: i < onboardingStep ? '#6366f1' : '#334155' }} />}
                </div>
              ))}
            </div>

            {onboardingStep === 0 && (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👋</div>
                <h2 style={{ marginBottom: 8 }}>Welcome to AI Ad Platform!</h2>
                <p className="subtitle" style={{ marginBottom: 24 }}>
                  Create AI-powered ads in minutes and publish them across all your social channels.
                  Let's get you set up quickly.
                </p>
                <button type="button" className="chip active" style={{ fontSize: '1rem', padding: '12px 32px' }} onClick={() => setOnboardingStep(1)}>
                  Get Started →
                </button>
              </>
            )}

            {onboardingStep === 1 && (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
                <h2 style={{ marginBottom: 8 }}>Connect Your Platforms</h2>
                <p className="subtitle" style={{ marginBottom: 20 }}>
                  Connect at least one social account to start publishing. You can always add more later.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {(['tiktok', 'meta', 'x', 'youtube', 'linkedin'] as const).map((p) => {
                    const connected = connectedTokens.some((t) => t.platform === p);
                    const labels: Record<string, string> = { tiktok: 'TikTok', meta: 'Meta (Facebook/Instagram)', x: 'X (Twitter)', youtube: 'YouTube', linkedin: 'LinkedIn' };
                    return (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', borderRadius: 8, padding: '10px 14px' }}>
                        <span style={{ fontWeight: 600 }}>{labels[p]}</span>
                        {connected ? (
                          <span style={{ color: '#22c55e', fontSize: 13 }}>● Connected</span>
                        ) : (
                          <a href={`/api/v1/oauth/${p}/start`} className="chip" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 12px' }}>
                            Connect
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button type="button" className="chip" onClick={() => setOnboardingStep(2)}>Skip for now</button>
                  {connectedTokens.length > 0 && (
                    <button type="button" className="chip active" onClick={() => setOnboardingStep(2)}>Continue →</button>
                  )}
                </div>
              </>
            )}

            {onboardingStep === 2 && (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎉</div>
                <h2 style={{ marginBottom: 8 }}>You're all set!</h2>
                <p className="subtitle" style={{ marginBottom: 24 }}>
                  Start by uploading your person video or photo in the <strong>Jobs</strong> section, and we'll generate your first AI ad.
                </p>
                <button
                  type="button"
                  className="chip active"
                  style={{ fontSize: '1rem', padding: '12px 32px' }}
                  onClick={() => {
                    if (session) {
                      localStorage.setItem(`onboarded_${session.user.id}`, '1');
                    }
                    setShowOnboarding(false);
                    setActiveSection('Jobs');
                  }}
                >
                  Start Creating
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <aside className="sidebar">
        <h2>AI Ad Platform</h2>
        <div className="card auth-card">
          <h3>Session</h3>
          <p className="subtitle">{session?.user?.email ? `Signed in: ${session.user.email}` : 'Not signed in'}</p>
          <input
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="you@company.com"
          />
          <div className="job-actions">
            <button type="button" className="chip" onClick={signInWithEmail} disabled={authBusy}>
              {authBusy ? 'Sending...' : 'Email Sign In'}
            </button>
            <button type="button" className="chip" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </div>
        <nav>
          {sections.map((item) => (
            <div
              key={item}
              className={`nav-item${activeSection === item ? ' active' : ''}`}
              onClick={() => setActiveSection(item)}
              style={{ cursor: 'pointer' }}
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      <section className="content">
        {activeSection === 'Jobs' && (
          <>
        <h1>Build Ad Job</h1>
        <p className="subtitle">
          Upload person media (video or photo), add optional product photo, and queue a generation job.
        </p>

        <form className="card" onSubmit={onSubmit}>
          <label>
            Person media (MP4/MOV or JPG/PNG/WEBP)
            <input
              type="file"
              accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
              onChange={(event) => setPersonFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label>
            Product photo (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setProductFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label>
            Product description (optional if product photo provided)
            <textarea
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              rows={3}
              placeholder="Describe the item the AI person should work with"
            />
          </label>

          <label>
            Tone
            <input value={tone} onChange={(event) => setTone(event.target.value)} />
          </label>

          <div>
            <p className="label-title">Target platforms</p>
            <div className="chips">
              {platforms.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={selectedPlatforms.includes(platform) ? 'chip active' : 'chip'}
                  onClick={() => togglePlatform(platform)}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}
          {info ? <p className="subtitle">{info}</p> : null}

          <button type="submit" disabled={submitting} className="primary-btn">
            {submitting ? 'Creating...' : 'Create Job'}
          </button>
        </form>

        <div className="card">
          <h2>Recent Jobs</h2>
          {jobs.length === 0 ? (
            <p className="subtitle">No jobs yet.</p>
          ) : (
            <div className="jobs-list">
              {jobs.map((job) => {
                const isWatched = watchedJobId === job.id;
                const canPreview = true;
                const statusColor =
                  job.status === 'failed' ? '#ef4444'
                  : job.status === 'published' ? '#22c55e'
                  : job.status === 'awaiting_approval' ? '#6366f1'
                  : job.status === 'processing' ? '#f59e0b'
                  : '#64748b';

                return (
                  <article key={job.id} className="job-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0 }} />
                      <strong style={{ color: statusColor }}>{job.status}</strong>
                      {isWatched && <span style={{ color: '#f59e0b', fontSize: 12 }}>● live</span>}
                      <span style={{ color: '#64748b', fontSize: 13 }}>· {new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                    <div>Source: {job.personSourceType} — {job.personSourceName}</div>
                    <div>Platforms: {job.targetPlatforms.join(', ') || 'none'}</div>
                    {job.productDescription && <div>Description: {job.productDescription}</div>}
                    <div className="job-actions">
                      {canPreview && (
                        <button
                          type="button"
                          className="chip active"
                          onClick={() => { setPreviewJob(job); setEditCaption(job.productDescription ?? ''); }}
                        >
                          Preview &amp; Approve
                        </button>
                      )}
                      {!canPreview && (
                        <button type="button" className="chip" onClick={() => updateStatus(job.id, 'approve')}>
                          Approve
                        </button>
                      )}
                      <button type="button" className="chip" onClick={() => updateStatus(job.id, 'regenerate')}>
                        Regenerate
                      </button>
                      <button type="button" className="chip" onClick={() => publishJob(job)} disabled={working}>
                        Publish
                      </button>
                      {!isWatched && !['published', 'failed'].includes(job.status) && (
                        <button type="button" className="chip" onClick={() => setWatchedJobId(job.id)}>
                          Watch Live
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}

        {activeSection === 'Published' && (
          <>
            <h1>Published</h1>
            <div className="card">
              <h2>Published Post Groups</h2>
              {publishedPosts.length === 0 ? (
                <p className="subtitle">No published post groups yet.</p>
              ) : (
                <div className="jobs-list">
                  {publishedPosts.map((post) => (
                    <article key={post.id} className="job-item">
                      <div>
                        <strong>{post.status}</strong> · {new Date(post.createdAt).toLocaleString()}
                      </div>
                      <div>Job: {post.jobId}</div>
                      <div>Platforms: {post.platforms.join(', ') || 'none'}</div>
                      <div className="job-actions">
                        <button type="button" className="chip" onClick={() => boostPost(post)} disabled={working}>
                          Boost Post
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => loadPostDetail(post)}
                          disabled={working}
                        >
                          View Analytics
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeSection === 'Analytics' && (() => {
          const CHART_COLORS: Record<string, string> = {
            tiktok: '#69C9D0', meta: '#1877F2', x: '#E7E9EA', youtube: '#FF0000', linkedin: '#0A66C2',
          };
          const PLATFORMS_ORDER = ['tiktok', 'meta', 'x', 'youtube', 'linkedin'] as const;

          // Views-over-time line chart data
          const dateMap: Record<string, Record<string, number>> = {};
          for (const pt of analyticsPoints) {
            const d = new Date(pt.capturedAt).toLocaleDateString();
            if (!dateMap[d]) dateMap[d] = {};
            dateMap[d][pt.platform] = (dateMap[d][pt.platform] ?? 0) + pt.views;
          }
          const viewsData = Object.entries(dateMap)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([date, vals]) => ({ date, ...vals }));

          // Platform totals bar chart
          const platformTotals: Record<string, { views: number; reach: number; clicks: number }> = {};
          for (const pt of analyticsPoints) {
            if (!platformTotals[pt.platform]) platformTotals[pt.platform] = { views: 0, reach: 0, clicks: 0 };
            platformTotals[pt.platform].views += pt.views;
            platformTotals[pt.platform].reach += pt.reach;
            platformTotals[pt.platform].clicks += pt.clicks;
          }
          const platformBarData = Object.entries(platformTotals).map(([platform, v]) => ({ platform, ...v }));

          // Spend donut from campaigns
          const spendByPlatform: Record<string, number> = {};
          for (const c of campaigns) {
            const key = c.postId;
            spendByPlatform[key] = (spendByPlatform[key] ?? 0) + (c.budget ?? 0);
          }
          const spendData = Object.entries(spendByPlatform).map(([name, value]) => ({ name, value }));
          const SPEND_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444'];

          const hasPoints = analyticsPoints.length > 0;
          const hasCampaigns = campaigns.length > 0;

          return (
            <>
              <h1>Analytics</h1>

              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Jobs', value: summary?.totalJobs ?? '—' },
                  { label: 'Published Posts', value: summary?.totalPosts ?? '—' },
                  { label: 'Campaigns', value: summary?.totalCampaigns ?? '—' },
                  { label: 'Total Spend', value: summary ? `$${summary.totalSpend.toFixed(2)}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366f1' }}>{value}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button type="button" className="chip" onClick={syncAnalytics} disabled={working}>
                    ↺ Sync
                  </button>
                </div>
              </div>

              {/* Views over time */}
              <div className="card">
                <h2>Views Over Time</h2>
                {!hasPoints ? (
                  <p className="subtitle">No metrics yet — select a published post and click Load Analytics.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={viewsData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }} />
                      <Legend />
                      {PLATFORMS_ORDER.filter(p => viewsData.some(d => p in d)).map(p => (
                        <Line key={p} type="monotone" dataKey={p} stroke={CHART_COLORS[p]} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Platform totals */}
              <div className="card">
                <h2>Platform Totals</h2>
                {platformBarData.length === 0 ? (
                  <p className="subtitle">No platform data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={platformBarData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <XAxis dataKey="platform" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }} />
                      <Legend />
                      <Bar dataKey="views" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="reach" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="clicks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Spend donut + campaign list side-by-side */}
              <div style={{ display: 'grid', gridTemplateColumns: hasCampaigns ? '280px 1fr' : '1fr', gap: '1rem' }}>
                {hasCampaigns && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h2>Ad Spend</h2>
                    <PieChart width={220} height={220}>
                      <Pie data={spendData} cx={105} cy={105} innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                        {spendData.map((_, i) => (
                          <Cell key={i} fill={SPEND_COLORS[i % SPEND_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`$${v as number}`, 'Spend']} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }} />
                    </PieChart>
                  </div>
                )}

                <div className="card">
                  <h2>Campaigns</h2>
                  {!hasCampaigns ? (
                    <p className="subtitle">No campaigns yet.</p>
                  ) : (
                    <div className="jobs-list">
                      {campaigns.map((campaign) => (
                        <div key={campaign.id} className="job-item">
                          <div style={{ fontWeight: 600 }}>{campaign.objective}</div>
                          <div className="subtitle">${campaign.budget} · {campaign.durationDays} days · Post {campaign.postId.slice(0, 8)}…</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })()}

        {activeSection === 'Platforms' && (
          <>
            <h1>Connected Platforms</h1>
            <p className="subtitle">Connect your social accounts to enable publishing, boosting, and analytics.</p>
            <div className="card">
              <h2>Platform Connections</h2>
              {error ? <p className="error">{error}</p> : null}
              {info ? <p className="subtitle">{info}</p> : null}
              <div className="jobs-list">
                {(['tiktok', 'meta', 'x', 'youtube', 'linkedin'] as const).map((p) => {
                  const token = connectedTokens.find((t) => t.platform === p);
                  const label = p === 'tiktok' ? 'TikTok'
                    : p === 'meta' ? 'Meta (Facebook/Instagram)'
                    : p === 'x' ? 'X (Twitter)'
                    : p === 'youtube' ? 'YouTube'
                    : 'LinkedIn';
                  return (
                    <div key={p} className="job-item">
                      <div>
                        <strong>{label}</strong>
                        {token ? (
                          <span style={{ marginLeft: 8, color: '#22c55e' }}>
                            ● Connected
                            {token.expiresAt
                              ? ` · expires ${new Date(token.expiresAt).toLocaleDateString()}`
                              : ''}
                          </span>
                        ) : (
                          <span style={{ marginLeft: 8, color: '#94a3b8' }}>○ Not connected</span>
                        )}
                      </div>
                      <div className="job-actions">
                        <a
                          href={`/api/v1/oauth/${p}/start`}
                          className="chip"
                          style={{ textDecoration: 'none', display: 'inline-block' }}
                        >
                          {token ? 'Reconnect' : 'Connect'}
                        </a>
                        {token && (
                          <button
                            type="button"
                            className="chip"
                            onClick={() => disconnectPlatform(p)}
                            disabled={working}
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeSection === 'Billing' && (
          <>
            <h1>Billing &amp; Subscription</h1>
            <div className="card">
              <h2>Current Plan</h2>
              {subscription ? (
                <div className="jobs-list">
                  <div className="job-item">
                    <strong>Plan:</strong> {subscription.plan} &middot; <em>{subscription.status}</em>
                  </div>
                  <div className="job-item">
                    <strong>Ad quota:</strong>{' '}
                    {subscription.quota.limit != null
                      ? `${subscription.quota.used} / ${subscription.quota.limit} jobs used`
                      : `${subscription.quota.used} (unlimited)`}
                    {subscription.quota.limit != null && subscription.quota.limit > 0 && (
                      <div style={{ marginTop: 6, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (subscription.quota.used / subscription.quota.limit) * 100)}%`,
                          background: subscription.quota.used / subscription.quota.limit > 0.9 ? '#ef4444' : '#6366f1',
                          borderRadius: 4
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="subtitle">No active subscription found.</p>
              )}
              <div className="job-actions" style={{ marginTop: 16 }}>
                <a href="/api/v1/billing/portal" className="chip" style={{ textDecoration: 'none', display: 'inline-block' }}>Manage Billing</a>
                <a href="/api/v1/billing/checkout" className="chip" style={{ textDecoration: 'none', display: 'inline-block' }}>Upgrade Plan</a>
              </div>
            </div>

            {/* Ad Credit Balance (4.5) */}
            <div className="card">
              <h2>Ad Credit Balance</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: creditBalance < 10 ? '#ef4444' : '#22c55e' }}>
                  ${creditBalance.toFixed(2)}
                </div>
                {creditBalance < 10 && (
                  <span style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                    Low balance
                  </span>
                )}
              </div>
              <p className="subtitle" style={{ marginBottom: 12 }}>
                Credits are deducted when you boost a post. Minimum $10 recommended to keep campaigns running.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={addCreditAmount}
                  onChange={(e) => setAddCreditAmount(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }}
                >
                  {[10, 25, 50, 100, 250].map((v) => (
                    <option key={v} value={v}>${v}</option>
                  ))}
                </select>
                <button type="button" className="chip active" onClick={handleAddCredits} disabled={addCreditBusy}>
                  {addCreditBusy ? 'Redirecting…' : 'Add Credits via Stripe'}
                </button>
              </div>
            </div>
          </>
        )}

        {activeSection === 'Settings' && (
          <>
            <h1>Settings</h1>

            {/* Settings sub-tabs (6.5) */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {(['account', 'notifications', 'danger'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip${settingsTab === t ? ' active' : ''}`}
                  onClick={() => setSettingsTab(t)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {t === 'danger' ? 'Danger Zone' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Account tab */}
            {settingsTab === 'account' && (
              <div className="card">
                <h2>Account</h2>
                <p className="subtitle" style={{ marginBottom: 16 }}>
                  {session?.user?.email ? `Signed in as ${session.user.email}` : 'Not signed in.'}
                </p>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label htmlFor="display-name">Display Name</label>
                  <input
                    id="display-name"
                    type="text"
                    className="input"
                    placeholder="Your name"
                    defaultValue={session?.user?.user_metadata?.full_name ?? ''}
                  />
                </div>
                <div className="job-actions">
                  <button type="button" className="chip active">Save Changes</button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => getSupabaseBrowserClient()?.auth.resetPasswordForEmail(session?.user?.email ?? '')}
                  >
                    Reset Password
                  </button>
                  <button type="button" className="chip" onClick={signOut}>
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {/* Notifications tab */}
            {settingsTab === 'notifications' && (
              <div className="card">
                <h2>Notifications</h2>
                <p className="subtitle" style={{ marginBottom: 16 }}>
                  Control which emails you receive from us.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span
                      onClick={() => setNotifyEmail((v) => !v)}
                      style={{
                        display: 'inline-block',
                        width: 40,
                        height: 22,
                        borderRadius: 11,
                        background: notifyEmail ? '#6366f1' : '#334155',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 3,
                        left: notifyEmail ? 20 : 3,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.2s'
                      }} />
                    </span>
                    Job failure &amp; alert emails
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 40,
                        height: 22,
                        borderRadius: 11,
                        background: '#6366f1',
                        position: 'relative',
                        opacity: 0.5
                      }}
                    >
                      <span style={{ position: 'absolute', top: 3, left: 20, width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
                    </span>
                    Low credit balance warnings
                    <span style={{ fontSize: 11, color: '#64748b' }}>(always on)</span>
                  </label>
                </div>
                <div className="job-actions" style={{ marginTop: 20 }}>
                  <button type="button" className="chip active">Save Preferences</button>
                </div>
              </div>
            )}

            {/* Danger Zone tab */}
            {settingsTab === 'danger' && (
              <div className="card" style={{ border: '1px solid #7f1d1d' }}>
                <h2 style={{ color: '#ef4444' }}>Danger Zone</h2>
                <p className="subtitle" style={{ marginBottom: 16 }}>
                  These actions are irreversible. Please proceed with caution.
                </p>
                <div className="job-actions">
                  <button
                    type="button"
                    className="chip"
                    style={{ background: '#7f1d1d', borderColor: '#ef4444', color: '#fca5a5' }}
                    onClick={() => {
                      if (window.confirm('Delete your account and all associated data? This cannot be undone.')) {
                        fetch('/api/v1/account', { method: 'DELETE' }).then(() => signOut());
                      }
                    }}
                  >
                    Delete Account
                  </button>
                  <button
                    type="button"
                    className="chip"
                    style={{ background: '#431407', borderColor: '#f97316', color: '#fdba74' }}
                    onClick={() => {
                      if (window.confirm('Revoke all connected platform OAuth tokens?')) {
                        fetch('/api/v1/platforms/revoke-all', { method: 'POST' });
                      }
                    }}
                  >
                    Revoke All Platform Connections
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── AI Chat ─────────────────────────────────────────────────── */}
        {activeSection === 'AI Chat' && (
          <>
            <h1>AI Chat</h1>
            <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)', minHeight: 500 }}>
              {/* Sidebar: chat list */}
              <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <select value={chatEngine} onChange={(e) => setChatEngine(e.target.value)}
                    style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 12 }}>
                    {['openai','anthropic','gemini','deep_seek','x_ai','open_router','together'].map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <input value={chatModel} onChange={(e) => setChatModel(e.target.value)}
                  placeholder="Model ID…"
                  style={{ padding: '4px 8px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 12 }} />
                <button type="button" className="chip active" onClick={async () => { await createChat(); await loadChats(); }} disabled={chatBusy}
                  style={{ marginBottom: 8 }}>+ New Chat</button>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {chatLoading && <p className="subtitle">Loading…</p>}
                  {chats.length === 0 && !chatLoading && (
                    <p className="subtitle" style={{ fontSize: 12 }}>No chats yet.</p>
                  )}
                  {chats.map((c) => (
                    <div key={c.id} onClick={() => openChat(c.id)}
                      style={{
                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, fontSize: 12,
                        background: activeChatId === c.id ? '#1e293b' : 'transparent',
                        border: activeChatId === c.id ? '1px solid #334155' : '1px solid transparent',
                      }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                      <div style={{ color: '#64748b' }}>{c.engine} · {c.model}</div>
                    </div>
                  ))}
                </div>
                <button type="button" className="chip" onClick={loadChats} style={{ fontSize: 11 }}>Refresh</button>
              </div>

              {/* Chat area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!activeChatId && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p className="subtitle">Select or create a chat to begin.</p>
                  </div>
                )}
                {activeChatId && (
                  <>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {chatMessages.map((m) => (
                        <div key={m.id} style={{
                          alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          background: m.role === 'user' ? '#4f46e5' : '#1e293b',
                          borderRadius: 12, padding: '10px 14px', fontSize: 14, lineHeight: 1.6, color: '#f1f5f9',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {m.content}
                        </div>
                      ))}
                      {streamingContent && (
                        <div style={{ alignSelf: 'flex-start', maxWidth: '80%', background: '#1e293b', borderRadius: 12, padding: '10px 14px', fontSize: 14, lineHeight: 1.6, color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>
                          {streamingContent}<span style={{ opacity: 0.5 }}>▋</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChatMessage(); } }}
                        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                        rows={2}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', resize: 'none', fontSize: 14 }} />
                      <button type="button" className="chip active" onClick={() => void sendChatMessage()} disabled={chatBusy} style={{ alignSelf: 'flex-end' }}>
                        {chatBusy ? '…' : 'Send'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Image Generation ──────────────────────────────────────── */}
        {activeSection === 'Images' && (
          <>
            <h1>Image Generation</h1>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Engine</label>
                  <select value={imgEngine} onChange={(e) => setImgEngine(e.target.value as typeof imgEngine)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }}>
                    <option value="openai">OpenAI (DALL-E 3)</option>
                    <option value="fal_ai">fal.ai (FLUX)</option>
                    <option value="novita">Novita AI</option>
                    <option value="freepik">Freepik AI</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Size</label>
                  <select value={imgSize} onChange={(e) => setImgSize(e.target.value as typeof imgSize)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }}>
                    <option value="1024x1024">1024×1024 (Square)</option>
                    <option value="1024x1792">1024×1792 (Portrait)</option>
                    <option value="1792x1024">1792×1024 (Landscape)</option>
                  </select>
                </div>
              </div>
              <textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)}
                placeholder="Describe your image in detail…"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', resize: 'vertical', fontSize: 14, marginBottom: 8 }} />
              <input value={imgNeg} onChange={(e) => setImgNeg(e.target.value)}
                placeholder="Negative prompt (optional — what to avoid)"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', fontSize: 13, marginBottom: 10 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {imgEngine === 'openai' && (
                  <select value={imgQuality} onChange={(e) => setImgQuality(e.target.value as 'standard'|'hd')}
                    style={{ padding: '7px 10px', borderRadius: 7, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }}>
                    <option value="standard">Standard quality</option>
                    <option value="hd">HD quality</option>
                  </select>
                )}
                <select value={imgN} onChange={(e) => setImgN(parseInt(e.target.value))}
                  style={{ padding: '7px 10px', borderRadius: 7, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }}>
                  {[1,2,3,4].map((n) => <option key={n} value={n}>{n} image{n>1?'s':''}</option>)}
                </select>
                <button type="button" className="chip active" onClick={() => void generateImage()} disabled={imgBusy}>
                  {imgBusy ? 'Generating…' : 'Generate'}
                </button>
                <button type="button" className="chip" onClick={() => void loadImages()}>Load History</button>
              </div>
            </div>
            {imagesLoading && <p className="subtitle">Loading…</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {generatedImages.map((img) => (
                <div key={img.id} style={{ borderRadius: 10, overflow: 'hidden', background: '#1e293b', border: '1px solid #334155' }}>
                  <img src={img.image_url} alt={img.prompt} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.prompt}</p>
                    <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0' }}>{img.engine} · {new Date(img.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Text-to-Speech ────────────────────────────────────────── */}
        {activeSection === 'TTS' && (
          <>
            <h1>Text to Speech</h1>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Engine</label>
                  <select value={ttsEngine} onChange={(e) => {
                    const eng = e.target.value as typeof ttsEngine;
                    setTtsEngine(eng);
                    setTtsVoice(eng === 'openai' ? 'alloy' : eng === 'elevenlabs' ? '21m00Tcm4TlvDq8ikWAM' : 'george');
                    setTtsModel(eng === 'openai' ? 'tts-1-hd' : eng === 'elevenlabs' ? 'eleven_multilingual_v2' : 'simba-base');
                  }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }}>
                    <option value="openai">OpenAI TTS</option>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="speechify">Speechify</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Voice</label>
                  <input value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)}
                    placeholder="Voice ID…"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }} />
                </div>
              </div>
              <textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)}
                placeholder="Enter text to synthesize… (max 5000 chars)"
                rows={5}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', resize: 'vertical', fontSize: 14, marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{ttsText.length}/5000</span>
                <button type="button" className="chip active" onClick={() => void synthesizeTts()} disabled={ttsBusy}>
                  {ttsBusy ? 'Synthesizing…' : 'Synthesize'}
                </button>
                <button type="button" className="chip" onClick={() => void loadTtsHistory()}>Load History</button>
              </div>
            </div>
            {ttsLoading && <p className="subtitle">Loading…</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ttsHistory.map((item) => (
                <div key={item.id} className="card" style={{ padding: '12px 16px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text_input}</p>
                  <audio controls src={item.audio_url} style={{ width: '100%', height: 36 }} />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>{item.engine} · {new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Content Writer ────────────────────────────────────────── */}
        {activeSection === 'Writer' && (
          <>
            <h1>AI Content Writer</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div className="card">
                  <h3>Configure</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b' }}>Content Type</label>
                      <select value={writerType} onChange={(e) => setWriterType(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }}>
                        {['article','blog','email','ad_copy','social','product_description','seo_meta','custom'].map((t) => (
                          <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b' }}>Title</label>
                      <input value={writerTitle} onChange={(e) => setWriterTitle(e.target.value)}
                        placeholder="Document title…"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b' }}>Topic / Brief</label>
                      <textarea value={writerTopic} onChange={(e) => setWriterTopic(e.target.value)}
                        placeholder="Describe what you want to write about…" rows={3}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', resize: 'none', marginTop: 4 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Tone</label>
                        <select value={writerTone} onChange={(e) => setWriterTone(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }}>
                          {['professional','casual','friendly','formal','persuasive','humorous','inspirational'].map((t) => (
                            <option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Word Count</label>
                        <input type="number" value={writerWords} onChange={(e) => setWriterWords(parseInt(e.target.value))}
                          min={50} max={5000}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b' }}>Keywords (comma-separated)</label>
                      <input value={writerKeywords} onChange={(e) => setWriterKeywords(e.target.value)}
                        placeholder="SEO, AI, growth…"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Engine</label>
                        <select value={writerEngine} onChange={(e) => setWriterEngine(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }}>
                          {['openai','anthropic','gemini','deep_seek','x_ai','together'].map((e) => (
                            <option key={e} value={e}>{e}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Model</label>
                        <input value={writerModel} onChange={(e) => setWriterModel(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }} />
                      </div>
                    </div>
                    <button type="button" className="chip active" onClick={() => void generateContent()} disabled={writerBusy}>
                      {writerBusy ? 'Writing…' : 'Generate Content'}
                    </button>
                  </div>
                </div>
                <div className="card" style={{ marginTop: 12 }}>
                  <h3>Recent Documents</h3>
                  <button type="button" className="chip" onClick={() => void loadWriterDocs()} style={{ marginBottom: 8 }}>Load</button>
                  {writerDocs.slice(0, 10).map((d) => (
                    <div key={d.id} className="job-item">
                      <span style={{ fontWeight: 600 }}>{d.title}</span>
                      <span className="chip" style={{ fontSize: 11, marginLeft: 6 }}>{d.type}</span>
                      <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>{d.words} words</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ minHeight: 400 }}>
                <h3>Output</h3>
                {writerBusy && <p className="subtitle">Writing…</p>}
                {writerOutput ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <button type="button" className="chip" onClick={() => navigator.clipboard.writeText(writerOutput)}>Copy</button>
                      <button type="button" className="chip" onClick={() => {
                        const el = document.createElement('a');
                        el.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(writerOutput);
                        el.download = `${writerTitle || 'content'}.txt`;
                        el.click();
                      }}>Download</button>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14, color: '#f1f5f9', margin: 0, overflowY: 'auto', maxHeight: '60vh' }}>
                      {writerOutput}
                    </pre>
                  </>
                ) : (
                  <p className="subtitle">Generated content will appear here.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Prompt Templates ─────────────────────────────────────── */}
        {activeSection === 'Prompts' && (
          <>
            <h1>Prompt Library</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card">
                <h3>Create Template</h3>
                <input value={promptTitle} onChange={(e) => setPromptTitle(e.target.value)}
                  placeholder="Template title…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginBottom: 8 }} />
                <textarea value={promptBody} onChange={(e) => setPromptBody(e.target.value)}
                  placeholder="Write your prompt here… Use {variable} for placeholders."
                  rows={6}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', resize: 'none', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input value={promptCategory} onChange={(e) => setPromptCategory(e.target.value)}
                    placeholder="Category…"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>
                    <input type="checkbox" checked={promptPublic} onChange={(e) => setPromptPublic(e.target.checked)} />
                    Public
                  </label>
                </div>
                <button type="button" className="chip active" onClick={() => void savePrompt()} disabled={promptBusy}>
                  {promptBusy ? 'Saving…' : 'Save Template'}
                </button>
              </div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Your Templates</h3>
                  <button type="button" className="chip" onClick={() => void loadPrompts()}>Refresh</button>
                </div>
                {promptsLoading && <p className="subtitle">Loading…</p>}
                {prompts.map((p) => (
                  <div key={p.id} className="job-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <strong style={{ color: '#f1f5f9' }}>{p.title}</strong>
                      <button type="button" onClick={() => void deletePrompt(p.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className="chip" style={{ fontSize: 10 }}>{p.category}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Used {p.use_count}×</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-line', maxHeight: 60, overflow: 'hidden' }}>{p.prompt}</p>
                    <button type="button" className="chip" style={{ fontSize: 11 }}
                      onClick={() => { setChatInput(p.prompt); setActiveSection('AI Chat'); }}>
                      Use in Chat →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Teams ─────────────────────────────────────────────────── */}
        {activeSection === 'Teams' && (
          <>
            <h1>Teams</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card">
                <h3>Create Team</h3>
                <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Team name…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginBottom: 10 }} />
                <button type="button" className="chip active" onClick={() => void createTeam()} disabled={teamsBusy}>
                  {teamsBusy ? 'Creating…' : 'Create Team'}
                </button>
              </div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Your Teams</h3>
                  <button type="button" className="chip" onClick={() => void loadTeams()}>Refresh</button>
                </div>
                {teams.length === 0 && <p className="subtitle">No teams yet.</p>}
                {teams.map((t) => (
                  <div key={t.id} className="job-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <strong style={{ color: '#f1f5f9' }}>{t.name}</strong>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="chip" style={{ fontSize: 11 }}>{t.myRole}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>/{t.slug}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Fine-tuning ───────────────────────────────────────────── */}
        {activeSection === 'Fine-tune' && (
          <>
            <h1>Fine-tuning</h1>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Create Fine-tune Job</h3>
              <p className="subtitle" style={{ marginBottom: 12 }}>
                Upload a JSONL training file via the <a href="https://platform.openai.com/files" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>OpenAI Files page</a>, then paste the file ID below.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b' }}>Base Model</label>
                  <select value={ftBaseModel} onChange={(e) => setFtBaseModel(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }}>
                    <option value="gpt-4o-mini-2024-07-18">GPT-4o Mini</option>
                    <option value="gpt-3.5-turbo-0125">GPT-3.5 Turbo</option>
                    <option value="gpt-4o-2024-08-06">GPT-4o</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b' }}>Training Epochs</label>
                  <input type="number" value={ftEpochs} onChange={(e) => setFtEpochs(parseInt(e.target.value))}
                    min={1} max={10}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginTop: 4 }} />
                </div>
              </div>
              <input value={ftFileId} onChange={(e) => setFtFileId(e.target.value)}
                placeholder="OpenAI file-… ID"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', marginBottom: 10 }} />
              <button type="button" className="chip active" onClick={() => void startFineTune()} disabled={ftBusy}>
                {ftBusy ? 'Submitting…' : 'Start Fine-tune'}
              </button>
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Your Jobs</h3>
                <button type="button" className="chip" onClick={() => void loadFineTunes()}>Refresh</button>
              </div>
              {ftJobs.length === 0 && <p className="subtitle">No fine-tune jobs yet.</p>}
              {ftJobs.map((j) => (
                <div key={j.id} className="job-item" style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <strong style={{ color: '#f1f5f9' }}>{j.base_model}</strong>
                    <span className={`chip${j.status === 'succeeded' ? ' active' : ''}`}
                      style={j.status === 'failed' ? { background: '#7f1d1d', color: '#fca5a5' } : {}}>
                      {j.status}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>{new Date(j.created_at).toLocaleDateString()}</span>
                  </div>
                  {j.fine_tuned_model && (
                    <div style={{ fontSize: 12, color: '#22c55e' }}>Model: {j.fine_tuned_model}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Admin ─────────────────────────────────────────────────── */}
        {activeSection === 'Admin' && (
          <>
            <h1>Admin Panel</h1>
            <button type="button" className="chip active" onClick={() => void loadAdminData()} disabled={adminLoading} style={{ marginBottom: 16 }}>
              {adminLoading ? 'Loading…' : 'Load Admin Data'}
            </button>

            {adminStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total Users',    value: adminStats.totalUsers },
                  { label: 'Total Chats',    value: adminStats.totalChats },
                  { label: 'Images Gen.',    value: adminStats.totalImages },
                  { label: 'TTS Outputs',    value: adminStats.totalTts },
                  { label: 'Documents',      value: adminStats.totalContent },
                  { label: 'Credits (30d)',  value: `$${adminStats.creditsLast30d.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#818cf8' }}>{value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {adminSettings.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3>AI Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adminSettings.map((s) => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
                      <span style={{ flex: '0 0 260px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{s.key}</span>
                      <span style={{ flex: 1, fontSize: 13, color: s.isSecret ? '#64748b' : '#f1f5f9' }}>{s.value ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminUsers.length > 0 && (
              <div className="card">
                <h3>Users ({adminUsers.length})</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155' }}>
                        {['Email', 'Name', 'Role', 'Plan', 'Joined'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '6px 10px', color: '#f1f5f9' }}>{u.email}</td>
                          <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{u.name ?? '—'}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span className={`chip${u.role === 'admin' ? ' active' : ''}`} style={{ fontSize: 10 }}>{u.role}</span>
                          </td>
                          <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{u.subscription?.plan ?? 'free'}</td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </section>
    </main>
  );
}
