-- ============================================================================
-- ARCHILYA SUPABASE MIGRATION
-- Firestore -> PostgreSQL Migration Script
-- Sıfırdan başlangıç - Tüm tablolar ve RLS politikaları
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CUSTOM TYPES (ENUMS)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('Aktif', 'İncelemede', 'Tamamlandı', 'Taslak');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('free', 'active', 'cancelled', 'expired', 'past_due');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('free', 'solo', 'pro', 'studio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_job_status AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_category AS ENUM ('member', 'project', 'credit', 'ai', 'subscription', 'file', 'workspace');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('credit_purchase', 'credit_deduct', 'credit_refund', 'subscription_payment', 'subscription_refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE storage_provider AS ENUM ('firebase', 'r2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. PROFILES (auth.users genişletmesi)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    credits INTEGER NOT NULL DEFAULT 0,
    total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
    subscription_status subscription_status NOT NULL DEFAULT 'free',
    subscription_plan subscription_plan NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    revenuecat_app_user_id TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Kullanıcı profilleri - auth.users tablosunu genişletir';

-- ============================================================================
-- 4. WORKSPACES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan subscription_plan NOT NULL DEFAULT 'free',
    credits INTEGER NOT NULL DEFAULT 0,
    used_storage BIGINT NOT NULL DEFAULT 0,
    max_storage BIGINT NOT NULL DEFAULT 1073741824, -- 1GB default
    branding_logo_url TEXT,
    branding_primary_color TEXT,
    branding_secondary_color TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspaces IS 'Çalışma alanları (workspaces)';

-- ============================================================================
-- 5. WORKSPACE MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

COMMENT ON TABLE workspace_members IS 'Workspace üyelikleri';

-- ============================================================================
-- 6. PROJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    status project_status NOT NULL DEFAULT 'Taslak',
    file_count JSONB NOT NULL DEFAULT '{"pdf": 0, "dwg": 0, "img": 0}'::jsonb,
    total_size BIGINT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE projects IS 'Projeler';

-- ============================================================================
-- 7. PROJECT MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

COMMENT ON TABLE project_members IS 'Proje üyelikleri';

-- ============================================================================
-- 8. PROJECT FILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    path TEXT,
    storage_provider storage_provider NOT NULL DEFAULT 'r2',
    object_key TEXT,
    content_type TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    versions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE project_files IS 'Proje dosyaları';

-- ============================================================================
-- 9. PROJECT INVITATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    status invite_status NOT NULL DEFAULT 'pending',
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

COMMENT ON TABLE project_invitations IS 'Proje davetleri';

-- ============================================================================
-- 10. WORKSPACE INVITES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    status invite_status NOT NULL DEFAULT 'pending',
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

COMMENT ON TABLE workspace_invites IS 'Workspace davetleri';

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    invite_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

COMMENT ON TABLE notifications IS 'Bildirimler';

-- ============================================================================
-- 12. AI STUDIO JOBS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_studio_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    status ai_job_status NOT NULL DEFAULT 'pending',
    prompt TEXT,
    tool_id TEXT,
    output_type TEXT,
    result_url TEXT,
    result_text TEXT,
    credit_cost INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE ai_studio_jobs IS 'AI Studio işleri';

-- ============================================================================
-- 13. AI HISTORY (Mobil)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT,
    tool TEXT,
    image_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_history IS 'AI geçmişi (mobil)';

-- ============================================================================
-- 14. CREDIT TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    type transaction_type NOT NULL,
    description TEXT,
    balance_after INTEGER NOT NULL,
    payment_session_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE credit_transactions IS 'Kredi işlemleri';

-- ============================================================================
-- 15. PAYMENT SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TRY',
    credit_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    payment_method TEXT,
    stripe_payment_intent_id TEXT,
    revenuecat_transaction_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE payment_sessions IS 'Ödeme oturumları';

-- ============================================================================
-- 16. REVENUECAT WEBHOOK EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS revenuecat_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    app_user_id TEXT NOT NULL,
    original_transaction_id TEXT,
    product_id TEXT,
    price NUMERIC(12,2),
    currency TEXT,
    is_trial_conversion BOOLEAN DEFAULT FALSE,
    is_renewal BOOLEAN DEFAULT FALSE,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE revenuecat_webhook_events IS 'RevenueCat webhook olayları';

-- ============================================================================
-- 17. CONTACT SUBMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE contact_submissions IS 'İletişim formu gönderimleri';

-- ============================================================================
-- 18. CONTACT RATE LIMITS
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier TEXT UNIQUE NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE contact_rate_limits IS 'İletişim formu rate limit kayıtları';

-- ============================================================================
-- 19. ADMINS
-- ============================================================================
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{}'::jsonb,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admins IS 'Admin kullanıcıları';

-- ============================================================================
-- 20. PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TRY',
    credit_amount INTEGER NOT NULL,
    stripe_price_id TEXT,
    revenuecat_product_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE products IS 'Kredi paketleri ve ürünler';

-- ============================================================================
-- 21. WORKSPACE ACTIVITY LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_email TEXT,
    actor_name TEXT,
    target_type TEXT,
    target_id UUID,
    target_name TEXT,
    category activity_category NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_activity_logs IS 'Workspace aktivite logları';

-- ============================================================================
-- 22. PROJECT ACTIVITY LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_email TEXT,
    actor_name TEXT,
    target_type TEXT,
    target_id UUID,
    target_name TEXT,
    category activity_category NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE project_activity_logs IS 'Proje aktivite logları';

-- ============================================================================
-- 23. RENDER SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS render_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    job_id UUID REFERENCES ai_studio_jobs(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')),
    stage INTEGER DEFAULT 0,
    total_stages INTEGER DEFAULT 0,
    scene_image_urls TEXT[],
    scene_ids TEXT[],
    moodboard_urls TEXT[],
    result_urls TEXT[],
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE render_sessions IS 'Render oturumları';

-- ============================================================================
-- 24. SUBSCRIPTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan subscription_plan NOT NULL DEFAULT 'free',
    status subscription_status NOT NULL DEFAULT 'free',
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    revenuecat_app_user_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subscriptions IS 'Abonelikler';

-- ============================================================================
-- 25. USER SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'tr',
    theme TEXT NOT NULL DEFAULT 'dark',
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_settings IS 'Kullanıcı ayarları';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_status, subscription_plan);

-- Workspaces indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_admin ON workspaces(admin_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_plan ON workspaces(plan);

-- Workspace members indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(is_deleted, deleted_at);

-- Project members indexes
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Project files indexes
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_deleted ON project_files(is_deleted, deleted_at);

-- Invitations indexes
CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_to_email ON project_invitations(to_email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON project_invitations(status);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_to_email ON workspace_invites(to_email);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_status ON workspace_invites(status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- AI Jobs indexes
CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_user ON ai_studio_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_workspace ON ai_studio_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_studio_jobs_status ON ai_studio_jobs(status);

-- AI History indexes
CREATE INDEX IF NOT EXISTS idx_ai_history_user ON ai_history(user_id);

-- Credit transactions indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_workspace ON credit_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);

-- Payment sessions indexes
CREATE INDEX IF NOT EXISTS idx_payment_sessions_user ON payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_token ON payment_sessions(token);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_workspace_activity_logs_workspace ON workspace_activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_logs_created ON workspace_activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_activity_logs_project ON project_activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_logs_created ON project_activity_logs(created_at DESC);

-- Render sessions indexes
CREATE INDEX IF NOT EXISTS idx_render_sessions_user ON render_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_render_sessions_project ON render_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_render_sessions_job ON render_sessions(job_id);

-- RevenueCat webhook indexes
CREATE INDEX IF NOT EXISTS idx_revenuecat_events_app_user ON revenuecat_webhook_events(app_user_id);
CREATE INDEX IF NOT EXISTS idx_revenuecat_events_processed ON revenuecat_webhook_events(processed);

-- Contact submissions indexes
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions(created_at DESC);

-- ============================================================================
-- RLS (ROW LEVEL SECURITY) ENABLE
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_studio_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE render_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- PROFILES
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
    ON profiles FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- WORKSPACES
CREATE POLICY "Workspace members can view workspace"
    ON workspaces FOR SELECT
    USING (
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT user_id FROM workspace_members 
            WHERE workspace_id = workspaces.id
        )
    );

CREATE POLICY "Workspace admin can update workspace"
    ON workspaces FOR UPDATE
    USING (auth.uid() = admin_id);

CREATE POLICY "Service role can manage workspaces"
    ON workspaces FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- WORKSPACE MEMBERS
CREATE POLICY "Workspace members can view members"
    ON workspace_members FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM workspace_members 
            WHERE workspace_id = workspace_members.workspace_id
        )
    );

CREATE POLICY "Workspace admin can manage members"
    ON workspace_members FOR ALL
    USING (
        auth.uid() = (
            SELECT admin_id FROM workspaces 
            WHERE id = workspace_members.workspace_id
        )
    );

CREATE POLICY "Service role can manage workspace members"
    ON workspace_members FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- PROJECTS
CREATE POLICY "Project members can view projects"
    ON projects FOR SELECT
    USING (
        auth.uid() = owner_id OR
        auth.uid() IN (
            SELECT user_id FROM project_members 
            WHERE project_id = projects.id
        )
    );

CREATE POLICY "Project owner can manage project"
    ON projects FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Service role can manage projects"
    ON projects FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- PROJECT MEMBERS
CREATE POLICY "Project members can view project members"
    ON project_members FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM project_members 
            WHERE project_id = project_members.project_id
        )
    );

CREATE POLICY "Project owner can manage members"
    ON project_members FOR ALL
    USING (
        auth.uid() = (
            SELECT owner_id FROM projects 
            WHERE id = project_members.project_id
        )
    );

CREATE POLICY "Service role can manage project members"
    ON project_members FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- PROJECT FILES
CREATE POLICY "Project members can view files"
    ON project_files FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM project_members 
            WHERE project_id = project_files.project_id
        )
    );

CREATE POLICY "Project owner can manage files"
    ON project_files FOR ALL
    USING (
        auth.uid() = (
            SELECT owner_id FROM projects 
            WHERE id = project_files.project_id
        )
    );

CREATE POLICY "Service role can manage files"
    ON project_files FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- PROJECT INVITATIONS
CREATE POLICY "Involved users can view project invitations"
    ON project_invitations FOR SELECT
    USING (
        auth.uid() = from_user_id OR 
        auth.uid() = to_user_id OR
        auth.uid() IN (
            SELECT user_id FROM project_members 
            WHERE project_id = project_invitations.project_id
        )
    );

CREATE POLICY "Service role can manage project invitations"
    ON project_invitations FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- WORKSPACE INVITES
CREATE POLICY "Involved users can view workspace invites"
    ON workspace_invites FOR SELECT
    USING (
        auth.uid() = from_user_id OR 
        auth.uid() = to_user_id OR
        auth.uid() IN (
            SELECT user_id FROM workspace_members 
            WHERE workspace_id = workspace_invites.workspace_id
        )
    );

CREATE POLICY "Service role can manage workspace invites"
    ON workspace_invites FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage notifications"
    ON notifications FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- AI STUDIO JOBS
CREATE POLICY "Users can view own AI jobs"
    ON ai_studio_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own AI jobs"
    ON ai_studio_jobs FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage AI jobs"
    ON ai_studio_jobs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- AI HISTORY
CREATE POLICY "Users can view own AI history"
    ON ai_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own AI history"
    ON ai_history FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage AI history"
    ON ai_history FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- CREDIT TRANSACTIONS
CREATE POLICY "Users can view own credit transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credit transactions"
    ON credit_transactions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- PAYMENT SESSIONS
CREATE POLICY "Users can view own payment sessions"
    ON payment_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payment sessions"
    ON payment_sessions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- WORKSPACE ACTIVITY LOGS
CREATE POLICY "Workspace members can view activity logs"
    ON workspace_activity_logs FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM workspace_members 
            WHERE workspace_id = workspace_activity_logs.workspace_id
        )
    );

CREATE POLICY "Service role can manage activity logs"
    ON workspace_activity_logs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- PROJECT ACTIVITY LOGS
CREATE POLICY "Project members can view activity logs"
    ON project_activity_logs FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM project_members 
            WHERE project_id = project_activity_logs.project_id
        )
    );

CREATE POLICY "Service role can manage activity logs"
    ON project_activity_logs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- RENDER SESSIONS
CREATE POLICY "Users can view own render sessions"
    ON render_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own render sessions"
    ON render_sessions FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage render sessions"
    ON render_sessions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- SUBSCRIPTIONS
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- USER SETTINGS
CREATE POLICY "Users can view own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Service role can manage settings"
    ON user_settings FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- CONTACT SUBMISSIONS (Admin only via service role or admin check)
CREATE POLICY "Service role can manage contact submissions"
    ON contact_submissions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- CONTACT RATE LIMITS
CREATE POLICY "Service role can manage rate limits"
    ON contact_rate_limits FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ADMINS
CREATE POLICY "Service role can manage admins"
    ON admins FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- PRODUCTS (Read-only for users, admin manages)
CREATE POLICY "Anyone can view active products"
    ON products FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Service role can manage products"
    ON products FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- REVENUECAT WEBHOOK EVENTS
CREATE POLICY "Service role can manage webhook events"
    ON revenuecat_webhook_events FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Profiles trigger
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Workspaces trigger
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Projects trigger
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Project files trigger
CREATE TRIGGER update_project_files_updated_at
    BEFORE UPDATE ON project_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Project invitations trigger
CREATE TRIGGER update_project_invitations_updated_at
    BEFORE UPDATE ON project_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Workspace invites trigger
CREATE TRIGGER update_workspace_invites_updated_at
    BEFORE UPDATE ON workspace_invites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- AI Studio Jobs trigger
CREATE TRIGGER update_ai_studio_jobs_updated_at
    BEFORE UPDATE ON ai_studio_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Render Sessions trigger
CREATE TRIGGER update_render_sessions_updated_at
    BEFORE UPDATE ON render_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions trigger
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Products trigger
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User Settings trigger
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTH TRIGGER: Auto-create profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NOW(), NOW());
    
    INSERT INTO public.user_settings (id, language, theme, updated_at)
    VALUES (NEW.id, 'tr', 'dark', NOW());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default products (credit packages)
INSERT INTO products (name, description, price, currency, credit_amount, is_active, metadata)
VALUES 
    ('Başlangıç Paketi', '100 Kredi', 49.99, 'TRY', 100, TRUE, '{"popular": false}'::jsonb),
    ('Pro Paketi', '500 Kredi', 199.99, 'TRY', 500, TRUE, '{"popular": true}'::jsonb),
    ('Enterprise Paketi', '2000 Kredi', 699.99, 'TRY', 2000, TRUE, '{"popular": false}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
