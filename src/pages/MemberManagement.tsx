import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonText,
  IonSpinner,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { add, create, trash, camera, arrowBack } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { Camera, CameraResultType } from '@capacitor/camera';
import { getMembers, addMember, updateMember, deleteMember, Member, setOrganizationContext } from '../services/supabaseClient';
import { faceRecognitionService } from '../services/faceRecognition';
import { useOrganization } from '../contexts/OrganizationContext';

const MemberManagement: React.FC = () => {
  const history = useHistory();
  const { organization, user, isAuthenticated, isLegacyMode } = useOrganization();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newMember, setNewMember] = useState({
    name: '',
    status: 'Allowed' as 'Allowed' | 'Banned' | 'VIP',
    photo_url: ''
  });

  useEffect(() => {
    // Check authentication and redirect if needed
    if (!isAuthenticated && !isLegacyMode) {
      history.push('/login');
      return;
    }

    // Set organization context if in SaaS mode
    if (!isLegacyMode && organization) {
      setOrganizationContext(organization.id);
    }

    loadMembers();
  }, [isAuthenticated, isLegacyMode, organization, history]);

  useEffect(() => {
    filterMembers();
  }, [members, searchText]);


  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    if (!searchText.trim()) {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter(member =>
        member.name.toLowerCase().includes(searchText.toLowerCase()) ||
        member.status.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  };

  const takePicture = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl
      });

      if (image.dataUrl) {
        setNewMember(prev => ({ ...prev, photo_url: image.dataUrl! }));
        // Here you would process the image for face embedding
        await processPhotoForEmbedding(image.dataUrl);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const processPhotoForEmbedding = async (dataUrl: string) => {
    try {
      const img = new Image();
      img.onload = async () => {
        try {
          const faces = await faceRecognitionService.detectFaces(img);
          if (faces.length > 0) {
            const embedding = faceRecognitionService.generateEmbedding(faces[0]);
            setNewMember(prev => ({ ...prev, face_embedding: embedding }));
          }
        } catch (error) {
          console.error('Error processing face embedding:', error);
        }
      };
      img.src = dataUrl;
    } catch (error) {
      console.error('Error processing photo:', error);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim()) return;

    setLoading(true);
    try {
      await addMember({
        name: newMember.name,
        status: newMember.status,
        photo_url: newMember.photo_url,
        face_embedding: (newMember as any).face_embedding || null
      });
      
      setShowAddModal(false);
      setNewMember({ name: '', status: 'Allowed', photo_url: '' });
      await loadMembers();
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;

    setLoading(true);
    try {
      await updateMember(editingMember.id, {
        name: editingMember.name,
        status: editingMember.status
      });
      
      setEditingMember(null);
      await loadMembers();
    } catch (error) {
      console.error('Error updating member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      setLoading(true);
      try {
        await deleteMember(id);
        await loadMembers();
      } catch (error) {
        console.error('Error deleting member:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const refresh = async (event: any) => {
    await loadMembers();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#1a1d29', '--color': '#e2e8f0' }}>
          <IonButton
            slot="start"
            fill="clear"
            onClick={() => isLegacyMode ? history.push('/admin/dashboard') : history.push('/admin')}
            style={{ '--color': '#3b82f6' }}
          >
            <IonIcon icon={arrowBack} />
          </IonButton>
          <IonTitle>
            {isLegacyMode ? 'Member Management' : `${organization?.name || 'Organization'} - Members`}
          </IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={() => setShowAddModal(true)}
            style={{ '--color': '#e2e8f0' }}
            disabled={!isLegacyMode && organization && members.length >= organization.member_limit}
          >
            <IonIcon icon={add} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen style={{ '--background': '#0f1419' }}>
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ padding: '10px' }}>
          {!isLegacyMode && organization && (
            <IonCard className="clean-card" style={{ margin: '16px 8px' }}>
              <IonCardContent style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#9ca3af', fontSize: '14px' }}>
                    Members: {members.length} / {organization.member_limit}
                  </span>
                  <div style={{
                    width: '120px',
                    height: '6px',
                    background: 'rgba(107, 114, 128, 0.3)',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(members.length / organization.member_limit) * 100}%`,
                      height: '100%',
                      background: members.length >= organization.member_limit ? '#dc2626' : '#3b82f6',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
                {members.length >= organization.member_limit && (
                  <p style={{ color: '#fca5a5', fontSize: '12px', margin: '8px 0 0 0' }}>
                    Member limit reached. Upgrade your plan to add more members.
                  </p>
                )}
              </IonCardContent>
            </IonCard>
          )}

          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value!)}
            placeholder="Search members..."
            style={{ '--background': 'rgba(26, 29, 41, 0.5)', '--color': '#e2e8f0' }}
          />

          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <IonSpinner />
            </div>
          )}

          {filteredMembers.map(member => (
            <IonCard key={member.id} className="admin-card">
              <IonCardContent>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    {member.photo_url && (
                      <img
                        src={member.photo_url}
                        alt={member.name}
                        className="member-photo"
                        style={{ marginRight: '15px' }}
                      />
                    )}
                    <div>
                      <h3 style={{ margin: '0 0 5px 0' }}>{member.name}</h3>
                      <IonText className={`status-${member.status.toLowerCase()}`}>
                        {member.status}
                      </IonText>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <IonButton
                      size="small"
                      fill="clear"
                      onClick={() => setEditingMember(member)}
                    >
                      <IonIcon icon={create} />
                    </IonButton>
                    <IonButton
                      size="small"
                      fill="clear"
                      color="danger"
                      onClick={() => handleDeleteMember(member.id)}
                    >
                      <IonIcon icon={trash} />
                    </IonButton>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          ))}

          {filteredMembers.length === 0 && !loading && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#666'
            }}>
              <p>No members found</p>
            </div>
          )}
        </div>

        {/* Add Member Modal */}
        <IonModal isOpen={showAddModal} onDidDismiss={() => setShowAddModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Add New Member</IonTitle>
              <IonButton
                slot="end"
                fill="clear"
                onClick={() => setShowAddModal(false)}
              >
                Close
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <div style={{ padding: '20px' }}>
              <IonItem>
                <IonInput
                  label="Name"
                  labelPlacement="floating"
                  value={newMember.name}
                  onIonInput={(e) => setNewMember(prev => ({ ...prev, name: e.detail.value! }))}
                />
              </IonItem>

              <IonItem>
                <IonSelect
                  label="Status"
                  value={newMember.status}
                  onSelectionChange={(e) => setNewMember(prev => ({ ...prev, status: e.detail.value }))}
                >
                  <IonSelectOption value="Allowed">Allowed</IonSelectOption>
                  <IonSelectOption value="VIP">VIP</IonSelectOption>
                  <IonSelectOption value="Banned">Banned</IonSelectOption>
                </IonSelect>
              </IonItem>

              <div style={{ margin: '20px 0' }}>
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={takePicture}
                >
                  <IonIcon icon={camera} slot="start" />
                  Take Photo
                </IonButton>
                
                {newMember.photo_url && (
                  <div style={{ marginTop: '15px', textAlign: 'center' }}>
                    <img
                      src={newMember.photo_url}
                      alt="Preview"
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                )}
              </div>

              <IonButton
                expand="block"
                onClick={handleAddMember}
                disabled={!newMember.name.trim() || loading}
              >
                {loading ? <IonSpinner /> : 'Add Member'}
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        {/* Edit Member Modal */}
        <IonModal isOpen={!!editingMember} onDidDismiss={() => setEditingMember(null)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Edit Member</IonTitle>
              <IonButton
                slot="end"
                fill="clear"
                onClick={() => setEditingMember(null)}
              >
                Close
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            {editingMember && (
              <div style={{ padding: '20px' }}>
                <IonItem>
                  <IonInput
                    label="Name"
                    labelPlacement="floating"
                    value={editingMember.name}
                    onIonInput={(e) => setEditingMember(prev => 
                      prev ? { ...prev, name: e.detail.value! } : null
                    )}
                  />
                </IonItem>

                <IonItem>
                  <IonSelect
                    label="Status"
                    value={editingMember.status}
                    onSelectionChange={(e) => setEditingMember(prev => 
                      prev ? { ...prev, status: e.detail.value } : null
                    )}
                  >
                    <IonSelectOption value="Allowed">Allowed</IonSelectOption>
                    <IonSelectOption value="VIP">VIP</IonSelectOption>
                    <IonSelectOption value="Banned">Banned</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonButton
                  expand="block"
                  style={{ marginTop: '20px' }}
                  onClick={handleUpdateMember}
                  disabled={loading}
                >
                  {loading ? <IonSpinner /> : 'Update Member'}
                </IonButton>
              </div>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default MemberManagement;