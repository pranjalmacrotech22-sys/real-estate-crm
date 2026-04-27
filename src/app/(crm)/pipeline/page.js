'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Sparkles, Phone, Star, MessageSquare, Trophy, XCircle, IndianRupee, MapPin } from 'lucide-react';
import styles from './pipeline.module.css';

const STAGES = [
  { key: 'new', label: 'New', color: '#74B9FF', icon: <Sparkles size={16} /> },
  { key: 'contacted', label: 'Contacted', color: '#A29BFE', icon: <Phone size={16} /> },
  { key: 'qualified', label: 'Qualified', color: '#FDCB6E', icon: <Star size={16} /> },
  { key: 'negotiation', label: 'Negotiation', color: '#00D2FF', icon: <MessageSquare size={16} /> },
  { key: 'won', label: 'Won', color: '#00B894', icon: <Trophy size={16} /> },
  { key: 'lost', label: 'Lost', color: '#FF6B6B', icon: <XCircle size={16} /> },
];

export default function PipelinePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  useEffect(() => {
    if (user) loadLeads();
  }, [user]);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      toast.error('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
  };

  const handleDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e, stageKey) => {
    e.preventDefault();
    setDragOverStage(null);

    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) {
      setDraggedLead(null);
      return;
    }

    const currentLead = leads.find(l => l.id === leadId);
    if (!currentLead || currentLead.status === stageKey) {
      setDraggedLead(null);
      return;
    }

    // Optimistic UI update
    setLeads(leads.map(l => l.id === leadId ? { ...l, status: stageKey } : l));

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: stageKey })
        .eq('id', leadId);
      if (error) throw error;
      toast.success(`Lead moved to ${stageKey}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update lead status');
      loadLeads(); // revert optimistic update
    }
    setDraggedLead(null);
  };

  const getLeadsByStage = (stage) => leads.filter(l => l.status === stage);

  const formatBudget = (val) => {
    if (!val) return '';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${(val / 1000).toFixed(0)}K`;
  };

  const getDaysAgo = (date) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Drag & drop leads between stages — {leads.length} leads in pipeline
          </p>
        </div>
        <a href="/leads" className="btn btn-primary">+ Add Lead</a>
      </div>

      {loading ? (
        <div className={styles.board}>
          {STAGES.map(s => (
            <div key={s.key} className={styles.column}>
              <div className="skeleton" style={{ height: 44 }} />
              <div className="skeleton" style={{ height: 120, marginTop: 10 }} />
              <div className="skeleton" style={{ height: 120, marginTop: 10 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.board}>
          {STAGES.map(stage => {
            const stageLeads = getLeadsByStage(stage.key);
            const isOver = dragOverStage === stage.key;

            return (
              <div
                key={stage.key}
                className={`${styles.column} ${isOver ? styles.columnDragOver : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.key)}
              >
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitle}>
                    <span className={styles.columnIcon} style={{ background: `${stage.color}22`, color: stage.color }}>
                      {stage.icon}
                    </span>
                    <span>{stage.label}</span>
                    <span className={styles.count} style={{ background: `${stage.color}20`, color: stage.color }}>
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                <div className={styles.cardList}>
                  {stageLeads.length === 0 ? (
                    <div className={styles.emptyCol}>
                      <span style={{ opacity: 0.3 }}>Drop leads here</span>
                    </div>
                  ) : (
                    stageLeads.map((lead, i) => (
                      <div
                        key={lead.id}
                        className={styles.leadCard}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        style={{ animationDelay: `${i * 60}ms`, borderLeftColor: stage.color }}
                      >
                        <div className={styles.cardTop}>
                          <div className={styles.cardAvatar} style={{ background: stage.color }}>
                            {lead.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.cardInfo}>
                            <span className={styles.cardName}>{lead.full_name}</span>
                            <span className={styles.cardPhone}>{lead.phone}</span>
                          </div>
                        </div>

                        <div className={styles.cardMeta}>
                          {lead.budget_max > 0 && (
                            <span className={styles.cardBudget}><IndianRupee size={12} style={{display:'inline',verticalAlign:'middle'}} /> {formatBudget(lead.budget_max)}</span>
                          )}
                          <span className={styles.cardSource}>{lead.source?.replace(/_/g, ' ')}</span>
                        </div>

                        {lead.preferred_location && (
                          <div className={styles.cardLocation}>
                            <MapPin size={12} style={{display:'inline',verticalAlign:'middle'}} /> {lead.preferred_location}
                          </div>
                        )}

                        <div className={styles.cardFooter}>
                          <span className={`badge badge-priority-${lead.priority}`}>{lead.priority}</span>
                          <span className={styles.cardDate}>{getDaysAgo(lead.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
