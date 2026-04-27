'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Handshake } from 'lucide-react';
import Modal from '@/components/Modal';
import styles from './partners.module.css';

export default function PartnersPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
  const emptyForm = { agency_name: '', broker_name: '', phone: '', rera_number: '', commission_percent: 2.0 };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadPartners();
  }, [user]);

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase.from('channel_partners').select('*').order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      setPartners(data || []);
    } catch (err) {
      toast.error('Failed to load partners. Did you run the SQL migration?');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.agency_name || !form.broker_name || !form.phone) {
      toast.warning('Agency, Broker Name, and Phone are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('channel_partners').insert([{
        ...form,
        user_id: user.id
      }]);
      if (error) throw error;
      toast.success('Channel Partner added');
      setModalOpen(false);
      setForm(emptyForm);
      loadPartners();
    } catch (err) {
      toast.error('Failed to add partner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Channel Partners</h1>
          <p className="text-muted">Manage your broker network and commissions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Partner</button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : partners.length === 0 ? (
        <div className="empty-state card">
          <Handshake size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>No Channel Partners</h3>
          <p>Add your first broker to start tracking their sales and commissions.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {partners.map(cp => (
            <div key={cp.id} className={styles.partnerCard}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.agencyName}>{cp.agency_name}</div>
                  <div className={styles.brokerName}>{cp.broker_name}</div>
                </div>
                <div className={styles.commissionBadge}>{cp.commission_percent}%</div>
              </div>
              
              <div className={styles.details}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Phone</span>
                  <span className={styles.detailValue}>{cp.phone}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>RERA No.</span>
                  <span className={styles.detailValue}>{cp.rera_number || 'N/A'}</span>
                </div>
              </div>
              
              <div className={styles.actions}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: 8 }}>View Bookings</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Channel Partner"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Add Partner'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Agency Name *</label>
            <input className="form-input" value={form.agency_name} onChange={e => setForm({...form, agency_name: e.target.value})} placeholder="e.g. Dream Homes Realty" />
          </div>
          <div className="form-group">
            <label className="form-label">Broker / Contact Name *</label>
            <input className="form-input" value={form.broker_name} onChange={e => setForm({...form, broker_name: e.target.value})} placeholder="e.g. Ramesh Singh" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91 99999 99999" />
          </div>
          <div className="form-group">
            <label className="form-label">RERA Registration No.</label>
            <input className="form-input" value={form.rera_number} onChange={e => setForm({...form, rera_number: e.target.value})} placeholder="e.g. UPRERAAGT1234" />
          </div>
          <div className="form-group">
            <label className="form-label">Standard Commission (%)</label>
            <input className="form-input" type="number" step="0.1" value={form.commission_percent} onChange={e => setForm({...form, commission_percent: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
