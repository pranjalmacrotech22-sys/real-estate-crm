'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/StatCard';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalLeads: 0, activeDeals: 0, pipelineValue: 0, conversionRate: 0 });
  const [recentLeads, setRecentLeads] = useState([]);
  const [upcomingFollowups, setUpcomingFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      // Load leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      // Load deals
      const { data: deals } = await supabase
        .from('deals')
        .select('*');

      // Load upcoming follow-ups
      const { data: followups } = await supabase
        .from('follow_ups')
        .select('*, leads(full_name)')
        .eq('status', 'pending')
        .gte('follow_up_date', new Date().toISOString())
        .order('follow_up_date', { ascending: true })
        .limit(5);

      const allLeads = leads || [];
      const allDeals = deals || [];
      const wonLeads = allLeads.filter(l => l.status === 'won').length;
      const activeDeals = allDeals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
      const pipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.deal_value || 0), 0);
      const conversionRate = allLeads.length > 0 ? ((wonLeads / allLeads.length) * 100).toFixed(1) : 0;

      setStats({
        totalLeads: allLeads.length,
        activeDeals: activeDeals.length,
        pipelineValue,
        conversionRate,
      });

      setRecentLeads(allLeads.slice(0, 6));
      setUpcomingFollowups(followups || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status) => `badge badge-${status}`;
  const getSourceIcon = (source) => {
    const icons = { website: '🌐', referral: '🤝', social_media: '📱', walk_in: '🚶', cold_call: '📞', advertisement: '📢', property_portal: '🏘️', other: '📋' };
    return icons[source] || '📋';
  };

  const generateAIInsights = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats,
          recentLeads: recentLeads.map(l => ({ full_name: l.full_name, status: l.status })),
          upcomingFollowups: upcomingFollowups.map(f => ({ 
            title: f.title, 
            follow_up_date: f.follow_up_date, 
            leads: { full_name: f.leads?.full_name } 
          }))
        })
      });
      
      const data = await response.json();
      if (data.insights) {
        // Parse bullet points from text
        const bullets = data.insights.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-*•]\s*/, '').trim());
        setAiInsights(bullets);
      } else {
        throw new Error(data.error || 'Failed to generate insights');
      }
    } catch (error) {
      console.error(error);
      setAiInsights(['Error: Could not connect to AI service. Please try again.']);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 style={{ marginBottom: 24 }}>Dashboard</h1>
        <div className={styles.statsGrid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 130, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    );
  }

  const todaysVisits = upcomingFollowups.filter(f => 
    f.follow_up_type === 'site_visit' && 
    new Date(f.follow_up_date).toDateString() === new Date().toDateString()
  );

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back! Here&apos;s your real estate overview.</p>
        </div>
        <div className={styles.headerActions}>
          <a href="/leads" className="btn btn-primary">+ Add Lead</a>
        </div>
      </div>

      {todaysVisits.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--text-primary)',
          fontWeight: '500',
          animation: 'fadeInUp 0.4s ease backwards'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔔</span>
          <div>
            <strong>Reminder:</strong> You have {todaysVisits.length} site visit{todaysVisits.length > 1 ? 's' : ''} scheduled for today. 
            <a href="/followups" style={{ marginLeft: 8, color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>View Calendar →</a>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <StatCard icon="👥" label="Total Leads" value={stats.totalLeads} trend="+12% this month" trendUp={true} color="primary" delay={0} />
        <StatCard icon="🤝" label="Active Deals" value={stats.activeDeals} trend="3 closing soon" trendUp={true} color="accent" delay={100} />
        <StatCard icon="💰" label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} trend="+8% growth" trendUp={true} color="success" delay={200} />
        <StatCard icon="📈" label="Conversion Rate" value={`${stats.conversionRate}%`} trend="Above average" trendUp={true} color="warning" delay={300} />
      </div>

      {/* AI Insights Card */}
      <div className={styles.aiCard}>
        <div className={styles.aiHeader}>
          <h3>✨ AI Assistant Insights</h3>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={generateAIInsights} 
            disabled={isGeneratingAI}
            style={{ borderRadius: 'var(--radius-full)', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            {isGeneratingAI ? 'Generating...' : aiInsights ? 'Refresh Insights' : 'Generate Insights'}
          </button>
        </div>
        
        <div className={styles.aiContent}>
          {isGeneratingAI ? (
            <div className={styles.aiLoading}>
              <div className={styles.spinner}></div>
              <span>Analyzing your CRM data...</span>
            </div>
          ) : aiInsights ? (
            <ul className={styles.aiList}>
              {aiInsights.map((insight, i) => (
                <li key={i} className={styles.aiListItem} style={{ animationDelay: `${i * 100}ms` }}>
                  <span>🎯</span>
                  <div>{insight}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Click &quot;Generate Insights&quot; to get personalized, AI-driven recommendations based on your pipeline and follow-ups.
            </div>
          )}
        </div>
      </div>

      <div className={styles.grid2} style={{ marginTop: 24 }}>
        {/* Recent Leads */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3>Recent Leads</h3>
            <a href="/leads" className="btn btn-ghost btn-sm">View All →</a>
          </div>
          {recentLeads.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '2.5rem' }}>👥</span>
              <h3>No leads yet</h3>
              <p>Start adding leads to see them here</p>
            </div>
          ) : (
            <div className={styles.leadList}>
              {recentLeads.map((lead, i) => (
                <div key={lead.id} className={styles.leadItem} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className={styles.leadAvatar}>
                    {lead.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.leadInfo}>
                    <span className={styles.leadName}>{lead.full_name}</span>
                    <span className={styles.leadMeta}>
                      {getSourceIcon(lead.source)} {lead.source?.replace('_', ' ')} • {lead.phone}
                    </span>
                  </div>
                  <div>
                    <span className={getStatusBadge(lead.status)}>{lead.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Follow-ups */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3>Upcoming Follow-ups</h3>
            <a href="/followups" className="btn btn-ghost btn-sm">View All →</a>
          </div>
          {upcomingFollowups.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '2.5rem' }}>📅</span>
              <h3>No upcoming follow-ups</h3>
              <p>Schedule follow-ups to stay on track</p>
            </div>
          ) : (
            <div className={styles.followupList}>
              {upcomingFollowups.map((fu, i) => (
                <div key={fu.id} className={styles.followupItem} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className={styles.followupDate}>
                    <span className={styles.fuDay}>{new Date(fu.follow_up_date).getDate()}</span>
                    <span className={styles.fuMonth}>{new Date(fu.follow_up_date).toLocaleString('en', { month: 'short' })}</span>
                  </div>
                  <div className={styles.followupInfo}>
                    <span className={styles.fuTitle}>{fu.title}</span>
                    <span className={styles.fuMeta}>
                      {fu.leads?.full_name} • {fu.follow_up_type?.replace('_', ' ')}
                    </span>
                  </div>
                  <span className={`badge badge-${fu.status}`}>{fu.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className={`card ${styles.section}`} style={{ marginTop: 20 }}>
        <div className={styles.sectionHeader}>
          <h3>Lead Pipeline Summary</h3>
          <a href="/pipeline" className="btn btn-ghost btn-sm">Open Pipeline →</a>
        </div>
        <div className={styles.pipelineBar}>
          {['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'].map(stage => {
            const count = recentLeads.filter(l => l.status === stage).length;
            const total = recentLeads.length || 1;
            const pct = ((count / total) * 100).toFixed(0);
            return (
              <div key={stage} className={styles.pipelineStage}>
                <div className={styles.pipelineStageBar}>
                  <div
                    className={`${styles.pipelineFill} ${styles[`fill_${stage}`]}`}
                    style={{ width: `${Math.max(pct, 5)}%` }}
                  />
                </div>
                <div className={styles.pipelineLabel}>
                  <span>{stage}</span>
                  <span className={styles.pipelineCount}>{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
