'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Search, Flame, Snowflake, CircleDot, Sparkles, Home, Mic, Loader2, Users, Bot } from 'lucide-react';
import Modal from '@/components/Modal';
import VoiceRecorder from '@/components/VoiceRecorder';
import styles from './leads.module.css';

const SOURCES = ['website', 'referral', 'social_media', 'walk_in', 'cold_call', 'advertisement', 'property_portal', 'other'];
const STATUSES = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PROPERTY_TYPES = ['residential', 'commercial', 'plot', 'villa', 'apartment', 'office', 'shop', 'other'];

const emptyLead = {
  full_name: '', email: '', phone: '', alternate_phone: '',
  source: 'walk_in', status: 'new', priority: 'medium',
  property_type: 'residential', budget_min: '', budget_max: '',
  preferred_location: '', assigned_to: '', notes: ''
};

export default function LeadsPage() {
  const { user, userProfile } = useAuth();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState({ ...emptyLead });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBudget, setFilterBudget] = useState('all');
  const [filterAiScore, setFilterAiScore] = useState('all');
  const [saving, setSaving] = useState(false);
  
  // Call Recording Upload State
  const [isUploadingCall, setIsUploadingCall] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && userProfile) {
      loadLeads();
      if (userProfile.role === 'admin') {
        loadAgents();
      }
    }
  }, [user, userProfile]);

  const loadAgents = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('admin_id', user.id).eq('role', 'agent');
      setAgents(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, follow_ups(*), assigned_profile:profiles(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const scoredLeads = (data || []).map(lead => {
        let score = 10; 
        if (lead.budget_max > 0) score += 20;
        const hasSiteVisit = lead.follow_ups?.some(f => f.follow_up_type === 'site_visit' && f.status === 'completed');
        if (hasSiteVisit) score += 30;
        const daysSinceUpdate = (new Date() - new Date(lead.updated_at)) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate <= 2) score += 20;
        if (lead.priority === 'urgent' || lead.priority === 'high') score += 20;
        score = Math.min(100, score);
        
        let aiLabel = 'Cold';
        let aiColor = 'var(--danger)';
        if (score >= 70) { aiLabel = 'Hot'; aiColor = 'var(--success)'; }
        else if (score >= 40) { aiLabel = 'Warm'; aiColor = 'var(--warning)'; }

        return { ...lead, ai_score: score, ai_label: aiLabel, ai_color: aiColor };
      });

      setLeads(scoredLeads);
    } catch (err) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingLead(null);
    setForm({ ...emptyLead });
    setModalOpen(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setForm({
      full_name: lead.full_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      alternate_phone: lead.alternate_phone || '',
      source: lead.source || 'walk_in',
      status: lead.status || 'new',
      priority: lead.priority || 'medium',
      property_type: lead.property_type || 'residential',
      budget_min: lead.budget_min || '',
      budget_max: lead.budget_max || '',
      preferred_location: lead.preferred_location || '',
      assigned_to: lead.assigned_to || '',
      notes: lead.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.phone) {
      toast.warning('Name and Phone are required');
      return;
    }
    setSaving(true);
    try {
      const leadData = { 
        ...form, 
        budget_min: Number(form.budget_min) || 0, 
        budget_max: Number(form.budget_max) || 0,
        assigned_to: form.assigned_to || null 
      };

      if (editingLead) {
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingLead.id);
        if (error) throw error;
        toast.success('Lead updated successfully');
      } else {
        const { error } = await supabase
          .from('leads')
          .insert({ ...leadData, user_id: user.id });
        if (error) throw error;
        toast.success('Lead added successfully');
      }
      setModalOpen(false);
      loadLeads();
    } catch (err) {
      toast.error(err.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const [viewingLead, setViewingLead] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const openViewModal = async (lead) => {
    setViewingLead(lead);
    loadCommunications(lead.id);
  };

  const loadCommunications = async (leadId) => {
    const { data } = await supabase.from('communications').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    setCommunications(data || []);
  };

  const handleCallUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !viewingLead) return;
    
    setIsUploadingCall(true);
    toast.info("Uploading and transcribing call...");

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('summarize_call', 'true');

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const summaryContent = `Call Recording Processed:\n\nTranscript Snippet: "${data.transcript.substring(0, 150)}..."\n\nAI Summary: ${data.extractedData?.summary}\n\nAction Items: ${(data.extractedData?.action_items || []).join(", ")}`;

      const { error } = await supabase.from('communications').insert([{
        lead_id: viewingLead.id,
        user_id: user.id,
        channel: 'whatsapp',
        direction: 'inbound',
        content: summaryContent,
        status: 'delivered'
      }]);

      if (error) throw error;
      
      toast.success('Call transcribed and summarized!');
      loadCommunications(viewingLead.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to transcribe call recording.');
    } finally {
      setIsUploadingCall(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAiAssist = async (action) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/leads/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: viewingLead, action })
      });
      const data = await res.json();
      
      if (action === 'score') {
        const { error } = await supabase.from('leads').update({ score: data.score, temperature: data.temperature }).eq('id', viewingLead.id);
        if (error) throw error;
        toast.success(`AI Scored: ${data.temperature} (${data.score})`);
        setViewingLead({ ...viewingLead, score: data.score, temperature: data.temperature });
        loadLeads();
      } else {
        const { error } = await supabase.from('communications').insert({
          lead_id: viewingLead.id,
          channel: 'whatsapp',
          direction: 'outbound',
          content: data.message,
          status: 'draft',
          is_automated: true
        });
        if (error) throw error;
        toast.success('AI Suggestion generated!');
        loadCommunications(viewingLead.id);
      }
    } catch (err) {
      toast.error('AI Assist failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const deleteLead = async (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      toast.success('Lead deleted');
      loadLeads();
    } catch (err) {
      toast.error('Failed to delete lead');
    }
  };

  const handleVoiceLead = async (extractedData, transcript) => {
    try {
      const newLead = {
        full_name: extractedData?.full_name || 'Voice Lead (Needs Name)',
        phone: extractedData?.phone || '0000000000',
        email: extractedData?.email || null,
        budget_max: extractedData?.budget_max || 0,
        preferred_location: extractedData?.preferred_location || null,
        property_type: extractedData?.property_type || 'residential',
        notes: `Extracted from Voice Note: "${transcript}"\n\nAI Extracted Notes: ${extractedData?.notes || ''}`,
        source: 'walk_in',
        user_id: user.id
      };
      
      const { data, error } = await supabase.from('leads').insert([newLead]);
      if (error) throw error;
      
      toast.success('Lead created from voice note!');
      loadLeads();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save voice lead to database.');
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) || l.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchesSource = filterSource === 'all' || l.source === filterSource;
    const matchesLocation = filterLocation === '' || l.preferred_location?.toLowerCase().includes(filterLocation.toLowerCase());
    
    let matchesBudget = true;
    if (filterBudget !== 'all') {
      const budget = Number(l.budget_max) || Number(l.budget_min) || 0;
      if (filterBudget === 'under_50l') matchesBudget = budget > 0 && budget < 5000000;
      else if (filterBudget === '50l_1cr') matchesBudget = budget >= 5000000 && budget <= 10000000;
      else if (filterBudget === 'above_1cr') matchesBudget = budget > 10000000;
    }

    const matchesAiScore = filterAiScore === 'all' || l.ai_label?.toLowerCase() === filterAiScore;

    return matchesSearch && matchesStatus && matchesSource && matchesLocation && matchesBudget && matchesAiScore;
  });

  const formatCurrency = (val) => val ? `₹${Number(val).toLocaleString('en-IN')}` : '-';
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Leads</h1>
          <p className="text-muted">Manage your incoming inquiries and prospects</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Lead</button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <span><Search size={16} /></span>
          <input
            type="text"
            placeholder="Search by name, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
            style={{ width: 160 }}
          />
        </div>
        <div className={styles.searchBox}>
          <span>📍</span>
          <input
            type="text"
            placeholder="Location..."
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className={styles.searchInput}
            style={{ width: 120 }}
          />
        </div>
        <select className="form-select" value={filterBudget} onChange={e => setFilterBudget(e.target.value)} style={{ width: 140 }}>
          <option value="all">All Budgets</option>
          <option value="under_50l">Under 50L</option>
          <option value="50l_1cr">50L - 1Cr</option>
          <option value="above_1cr">Above 1Cr</option>
        </select>
        <select className="form-select" value={filterAiScore} onChange={e => setFilterAiScore(e.target.value)} style={{ width: 130 }}>
          <option value="all">AI Score (All)</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 130 }}>
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="form-select" value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ width: 130 }}>
          <option value="all">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Users size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h3>No leads found</h3>
            <p>{search || filterStatus !== 'all' || filterSource !== 'all' ? 'Try adjusting your filters' : 'Click "Add Lead" to get started'}</p>
          </div>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>AI Score</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Budget</th>
                <th>Assigned To</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, i) => (
                <tr key={lead.id} className="animate-fadeInUp" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 'var(--radius-md)',
                        background: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.8rem', color: 'white', flexShrink: 0
                      }}>
                        {lead.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.full_name}</span>
                    </div>
                  </td>
                  <td>
                    {lead.temperature ? (
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 4, 
                        padding: '4px 8px', borderRadius: 0, 
                        background: lead.temperature === 'hot' ? 'rgba(0, 184, 148, 0.1)' : lead.temperature === 'warm' ? 'rgba(253, 203, 110, 0.1)' : 'rgba(255, 107, 107, 0.1)', 
                        color: lead.temperature === 'hot' ? 'var(--success)' : lead.temperature === 'warm' ? 'var(--warning)' : 'var(--danger)', 
                        fontWeight: 600, fontSize: '0.75rem' 
                      }}>
                        {lead.temperature === 'hot' ? <Flame size={12} style={{display:'inline',verticalAlign:'middle',color:'#ff6b6b'}} /> : lead.temperature === 'warm' ? <CircleDot size={12} style={{display:'inline',verticalAlign:'middle',color:'#fdcb6e'}} /> : <Snowflake size={12} style={{display:'inline',verticalAlign:'middle',color:'#74b9ff'}} />} {lead.temperature} ({lead.score || 0})
                      </div>
                    ) : (
                      <span className="text-muted" style={{fontSize: '0.8rem'}}>Unscored</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{lead.phone}</span>
                      {lead.email && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.email}</span>}
                    </div>
                  </td>
                  <td><span style={{ textTransform: 'capitalize' }}>{lead.source?.replace(/_/g, ' ')}</span></td>
                  <td><span className={`badge badge-${lead.status}`}>{lead.status}</span></td>
                  <td><span className={`badge badge-priority-${lead.priority}`}>{lead.priority}</span></td>
                  <td>
                    {lead.budget_min || lead.budget_max ? (
                      lead.budget_min && lead.budget_max && lead.budget_min !== lead.budget_max
                        ? `${formatCurrency(lead.budget_min)} - ${formatCurrency(lead.budget_max)}`
                        : formatCurrency(lead.budget_max || lead.budget_min)
                    ) : '-'}
                  </td>
                  <td>
                    {lead.assigned_to 
                      ? (lead.assigned_profile?.full_name || 'Agent') 
                      : <span style={{color:'var(--text-muted)'}}>Unassigned</span>}
                  </td>
                  <td>{formatDate(lead.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openViewModal(lead)} title="View Details">👁️</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(lead)} title="Edit">✏️</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteLead(lead.id)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLead ? 'Edit Lead' : 'Add New Lead'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingLead ? 'Update Lead' : 'Add Lead'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Enter full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select className="form-select" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Property Type</label>
            <select className="form-select" value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })}>
              {PROPERTY_TYPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Budget Min (₹)</label>
            <input className="form-input" type="number" value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Budget Max (₹)</label>
            <input className="form-input" type="number" value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} placeholder="0" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Preferred Location</label>
            <input className="form-input" value={form.preferred_location} onChange={e => setForm({ ...form, preferred_location: e.target.value })} placeholder="e.g., Sector 150, Noida" />
          </div>

          {userProfile?.role === 'admin' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Assign To Agent</label>
              <select className="form-select" value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">-- Unassigned (Keep to myself) --</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        title="Lead Smart Details"
        size="lg"
      >
        {viewingLead && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
            <div>
              <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 0, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0' }}>{viewingLead.full_name}</h3>
                <p className="text-muted" style={{ margin: 0 }}>{viewingLead.phone}</p>
                <div style={{ marginTop: 12 }}>
                  <span className={`badge badge-${viewingLead.status}`}>{viewingLead.status}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => handleAiAssist('score')} disabled={aiLoading}>
                  {aiLoading ? 'Analyzing...' : 'AI Lead Score'}
                </button>
                <button className="btn btn-secondary" onClick={() => handleAiAssist('suggest_followup')} disabled={aiLoading}>
                  {aiLoading ? 'Generating...' : <><Sparkles size={14} style={{display:'inline',verticalAlign:'middle'}} /> Draft WhatsApp Reply</>}
                </button>
                <button className="btn btn-secondary" onClick={() => handleAiAssist('recommend_properties')} disabled={aiLoading}>
                  {aiLoading ? 'Finding...' : <><Home size={14} style={{display:'inline',verticalAlign:'middle'}} /> Auto Recommend Properties</>}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', paddingLeft: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Timeline & Communications</h3>
                <div>
                  <input type="file" accept="audio/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCallUpload} />
                  <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingCall}>
                    {isUploadingCall ? <><Loader2 size={14} style={{display:'inline',verticalAlign:'middle'}} /> Analyzing...</> : <><Mic size={14} style={{display:'inline',verticalAlign:'middle'}} /> Upload Call</>}
                  </button>
                </div>
              </div>
              
              <div style={{ 
                border: '1px solid var(--border-color)', borderRadius: 0, height: 300, overflowY: 'auto', padding: 16,
                background: 'var(--bg-card)'
              }}>
                {communications.length === 0 ? (
                  <p className="text-muted">No communications yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {communications.map(msg => (
                      <div key={msg.id} style={{
                        padding: 12, borderRadius: 0,
                        background: msg.status === 'draft' ? 'rgba(253, 203, 110, 0.1)' : 'var(--bg-elevated)',
                        borderLeft: `4px solid ${msg.is_automated ? 'var(--primary)' : 'var(--success)'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem' }}>
                          <strong>{msg.is_automated ? <><Bot size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Automated</> : 'Agent'} ({msg.channel})</strong>
                          <span className="text-muted">{new Date(msg.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg.content}</p>
                        {msg.status === 'draft' && (
                          <div style={{ marginTop: 8, textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)' }}>Pending Review</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

