'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { IndianRupee, Users, TrendingUp, Briefcase } from 'lucide-react';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';

export default function TeamPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' or 'performance'
  const [performanceData, setPerformanceData] = useState({});
  const [teamStats, setTeamStats] = useState({
    totalRevenue: 0,
    totalLeads: 0,
    totalWon: 0,
    avgConversion: 0
  });
  
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadAgents();
  }, [user]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      // 1. Fetch agents who report to this admin
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('admin_id', user.id)
        .eq('role', 'agent')
        .order('created_at', { ascending: false });
        
      if (agentsError) throw agentsError;
      setAgents(agentsData || []);

      if (agentsData && agentsData.length > 0) {
        const agentIds = agentsData.map(a => a.id);

        // 2. Fetch Lead Stats for these agents
        const { data: leadStats, error: lError } = await supabase
          .from('lead_stats')
          .select('*')
          .in('user_id', agentIds);

        // 3. Fetch Deal Stats for these agents
        const { data: dealStats, error: dError } = await supabase
          .from('deal_stats')
          .select('*')
          .in('user_id', agentIds);

        // Map data to agent IDs
        const perfMap = {};
        agentIds.forEach(id => {
          const l = leadStats?.find(s => s.user_id === id) || {};
          const d = dealStats?.find(s => s.user_id === id) || {};
          perfMap[id] = { ...l, ...d };
        });
        setPerformanceData(perfMap);

        // Calculate Team Aggregates
        const totals = {
          totalRevenue: dealStats?.reduce((sum, d) => sum + Number(d.total_revenue || 0), 0) || 0,
          totalLeads: leadStats?.reduce((sum, l) => sum + Number(l.total_leads || 0), 0) || 0,
          totalWon: leadStats?.reduce((sum, l) => sum + Number(l.won_leads || 0), 0) || 0,
        };
        totals.avgConversion = totals.totalLeads > 0 
          ? ((totals.totalWon / totals.totalLeads) * 100).toFixed(1) 
          : 0;
        
        setTeamStats(totals);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async () => {
    if (!form.fullName || !form.email || !form.password) {
      toast.warning('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/team/add-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          adminId: user.id
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add agent');
      }

      toast.success('Agent added successfully');
      setModalOpen(false);
      setForm({ fullName: '', email: '', password: '' });
      loadAgents();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1>Team Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Monitor performance and manage your sales team
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Agent</button>
      </div>

      {!loading && agents.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '16px', 
          marginBottom: '32px' 
        }}>
          <StatCard icon={<IndianRupee size={24} />} label="Team Revenue" value={formatCurrency(teamStats.totalRevenue)} color="success" delay={0} />
          <StatCard icon={<Users size={24} />} label="Total Team Leads" value={teamStats.totalLeads} color="primary" delay={100} />
          <StatCard icon={<TrendingUp size={24} />} label="Avg. Conversion" value={`${teamStats.avgConversion}%`} color="warning" delay={200} />
          <StatCard icon={<Briefcase size={24} />} label="Active Agents" value={agents.length} color="accent" delay={300} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px' }}>
        <button 
          onClick={() => setActiveTab('roster')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'roster' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'roster' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Team Roster
        </button>
        <button 
          onClick={() => setActiveTab('performance')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'performance' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'performance' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Performance Metrics
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 60, width: '100%' }} />
          <div className="skeleton" style={{ height: 200, width: '100%' }} />
        </div>
      ) : agents.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}>👔</span>
            <h3>No agents found</h3>
            <p>Click "Add Agent" to invite your first team member.</p>
          </div>
        </div>
      ) : activeTab === 'roster' ? (
        <div className="data-table-wrapper animate-fadeIn">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.8rem', color: 'white'
                      }}>
                        {agent.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{agent.full_name}</span>
                    </div>
                  </td>
                  <td>{agent.email}</td>
                  <td><span className="badge badge-medium" style={{textTransform:'capitalize'}}>{agent.role}</span></td>
                  <td>{new Date(agent.created_at).toLocaleDateString()}</td>
                  <td><span className="badge badge-success">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="data-table-wrapper animate-fadeIn">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Leads</th>
                <th>Converted</th>
                <th>Conv. Rate</th>
                <th>Revenue</th>
                <th>Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const perf = performanceData[agent.id] || {};
                return (
                  <tr key={agent.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{agent.full_name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{perf.total_leads || 0} Total</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{perf.new_leads || 0} New</span>
                      </div>
                    </td>
                    <td>{perf.won_leads || 0}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: 'var(--border-color)', borderRadius: 0, overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${perf.conversion_rate || 0}%`, 
                            height: '100%', 
                            background: 'var(--warning)',
                            borderRadius: 0
                          }} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{perf.conversion_rate || 0}%</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                      {formatCurrency(perf.total_revenue || 0)}
                    </td>
                    <td>
                      {formatCurrency(perf.pipeline_value || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Agent Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Agent"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddAgent} disabled={saving}>
              {saving ? 'Adding...' : 'Create Agent'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              className="form-input" 
              value={form.fullName} 
              onChange={e => setForm({ ...form, fullName: e.target.value })} 
              placeholder="e.g. John Doe" 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address (Login ID)</label>
            <input 
              className="form-input" 
              type="email"
              value={form.email} 
              onChange={e => setForm({ ...form, email: e.target.value })} 
              placeholder="john@example.com" 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password</label>
            <input 
              className="form-input" 
              type="password"
              value={form.password} 
              onChange={e => setForm({ ...form, password: e.target.value })} 
              placeholder="Set a strong password" 
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

