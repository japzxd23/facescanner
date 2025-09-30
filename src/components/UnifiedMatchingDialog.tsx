import React from 'react';
import { IonCard, IonCardContent, IonSpinner } from '@ionic/react';

interface Member {
  id: string;
  name: string;
  photo_url?: string;
  status: 'Allowed' | 'Banned' | 'VIP';
  details?: string;
}

interface MatchingResults {
  capturedImage: string;
  bestMatch: Member | null;
  bestSimilarity: number;
  allMatches: Array<{member: Member, similarity: number}>;
  threshold: number;
}

interface UnifiedMatchingDialogProps {
  isOpen: boolean;
  dialogState: 'searching' | 'result';
  capturedImage: string;
  matchingResults: MatchingResults | null;
  dialogMemberPhoto: string | null;
  dialogCountdown: number;
  cooldownMessage: string;
  onClose: () => void;
  onRegister: () => void;
}

const UnifiedMatchingDialog: React.FC<UnifiedMatchingDialogProps> = ({
  isOpen,
  dialogState,
  capturedImage,
  matchingResults,
  dialogMemberPhoto,
  dialogCountdown,
  cooldownMessage,
  onClose,
  onRegister
}) => {
  if (!isOpen) return null;

  return (
    <IonCard
      className="unified-matching-dialog"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
        overflow: 'auto',
        boxShadow: 'none',
        borderRadius: 0,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        margin: 0
      }}
    >
      <IonCardContent style={{ padding: '24px', paddingTop: '80px' }}>

        {dialogState === 'searching' ? (
          // ============ SEARCHING STATE ============
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center text-gray-800 mb-4">
              🔍 Searching Database...
            </h2>

            {/* TWO IMAGES SIDE BY SIDE */}
            <div className="grid grid-cols-2 gap-4">
              {/* LEFT: Captured Image (Static) */}
              <div className="flex flex-col items-center">
                <div className="text-sm font-medium text-gray-600 mb-2">
                  Your Captured Photo
                </div>
                <img
                  src={capturedImage}
                  alt="Captured face"
                  className="w-full h-48 object-cover rounded-xl border-2 border-blue-300 shadow-lg"
                />
              </div>

              {/* RIGHT: Searching Indicator */}
              <div className="flex flex-col items-center">
                <div className="text-sm font-medium text-gray-600 mb-2">
                  Searching Database...
                </div>
                <div className="relative w-full h-48">
                  <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl border-2 border-gray-300 shadow-lg">
                    <IonSpinner name="crescent" style={{ width: '64px', height: '64px', color: '#3b82f6' }} />
                    <div className="text-gray-600 font-medium mt-4">Matching face...</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        ) : (
          // ============ RESULT STATE ============
          <div className="space-y-4">
            {matchingResults?.bestMatch ? (
              // MATCH FOUND
              matchingResults.bestMatch.status === 'Banned' ? (
                // ========== BANNED MEMBER ==========
                <div>
                  <h2 className="text-2xl font-bold text-center text-red-700 mb-4">
                    🚫 ACCESS DENIED
                  </h2>

                  {/* TWO IMAGES SIDE BY SIDE */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* LEFT: Captured Image */}
                    <div className="flex flex-col items-center">
                      <div className="text-sm font-medium text-gray-600 mb-2">
                        Captured Photo
                      </div>
                      <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full h-48 object-cover rounded-xl border-2 border-red-400 shadow-lg"
                      />
                    </div>

                    {/* RIGHT: Banned Member (Grayscale) */}
                    <div className="flex flex-col items-center">
                      <div className="text-sm font-medium text-red-600 mb-2">
                        Banned Member
                      </div>
                      {dialogMemberPhoto ? (
                        <img
                          src={dialogMemberPhoto}
                          alt={matchingResults.bestMatch.name}
                          className="w-full h-48 object-cover rounded-xl border-2 border-red-600 shadow-lg grayscale"
                        />
                      ) : (
                        <div className="w-full h-48 flex items-center justify-center bg-red-100 rounded-xl border-2 border-red-600">
                          <span className="text-4xl">🚫</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Match info */}
                  <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                    <h3 className="font-bold text-red-800 text-lg">{matchingResults.bestMatch.name}</h3>
                    <div className="text-sm text-red-600 mt-1">
                      Match Confidence: {(matchingResults.bestSimilarity * 100).toFixed(1)}%
                    </div>
                    {matchingResults.bestMatch.details && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                        <strong>Ban Reason:</strong> {matchingResults.bestMatch.details}
                      </div>
                    )}
                  </div>

                  {/* Warning Message */}
                  <div className="bg-red-100 border border-red-300 rounded-xl p-4 mt-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">⚠️</span>
                      <div>
                        <h4 className="font-bold text-red-800">Security Alert</h4>
                        <p className="text-sm text-red-700">This person has been denied access to the facility.</p>
                      </div>
                    </div>
                  </div>

                  {/* Manual close button */}
                  <button
                    onClick={onClose}
                    className="w-full mt-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors shadow-lg"
                  >
                    Close (Security Acknowledged)
                  </button>
                </div>

              ) : (
                // ========== ALLOWED/VIP MEMBER ==========
                <div>
                  <h2 className={`text-2xl font-bold text-center mb-4 ${
                    matchingResults.bestMatch.status === 'VIP'
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600'
                      : 'text-green-700'
                  }`}>
                    {matchingResults.bestMatch.status === 'VIP' ? '👑 VIP Access Granted' : '✅ Access Granted'}
                  </h2>

                  {/* TWO IMAGES SIDE BY SIDE */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* LEFT: Captured Image */}
                    <div className="flex flex-col items-center">
                      <div className="text-sm font-medium text-gray-600 mb-2">
                        Captured Photo
                      </div>
                      <img
                        src={capturedImage}
                        alt="Captured"
                        className={`w-full h-48 object-cover rounded-xl border-2 shadow-lg ${
                          matchingResults.bestMatch.status === 'VIP'
                            ? 'border-purple-400 ring-2 ring-purple-200'
                            : 'border-green-400 ring-2 ring-green-200'
                        }`}
                      />
                    </div>

                    {/* RIGHT: Matched Member (Clear) */}
                    <div className="flex flex-col items-center">
                      <div className={`text-sm font-medium mb-2 ${
                        matchingResults.bestMatch.status === 'VIP'
                          ? 'text-purple-600'
                          : 'text-green-600'
                      }`}>
                        Matched Member
                      </div>
                      {dialogMemberPhoto ? (
                        <img
                          src={dialogMemberPhoto}
                          alt={matchingResults.bestMatch.name}
                          className={`w-full h-48 object-cover rounded-xl border-2 shadow-lg ${
                            matchingResults.bestMatch.status === 'VIP'
                              ? 'border-purple-600 ring-2 ring-purple-200'
                              : 'border-green-600 ring-2 ring-green-200'
                          }`}
                        />
                      ) : (
                        <div className={`w-full h-48 flex items-center justify-center rounded-xl border-2 ${
                          matchingResults.bestMatch.status === 'VIP'
                            ? 'bg-purple-100 border-purple-600'
                            : 'bg-green-100 border-green-600'
                        }`}>
                          <span className="text-4xl">👤</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Match info */}
                  <div className={`p-4 rounded-xl border-2 ${
                    matchingResults.bestMatch.status === 'VIP'
                      ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                      : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                  }`}>
                    <h3 className="font-bold text-gray-800 text-lg">{matchingResults.bestMatch.name}</h3>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                      matchingResults.bestMatch.status === 'VIP'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {matchingResults.bestMatch.status === 'VIP' ? '👑' : '🟢'} {matchingResults.bestMatch.status}
                    </div>
                    <div className={`text-sm mt-2 ${
                      matchingResults.bestMatch.status === 'VIP' ? 'text-purple-600' : 'text-green-600'
                    }`}>
                      Match Confidence: {(matchingResults.bestSimilarity * 100).toFixed(1)}%
                    </div>
                    {matchingResults.bestMatch.status === 'VIP' && matchingResults.bestMatch.details && (
                      <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700">
                        <strong>VIP Notes:</strong> {matchingResults.bestMatch.details}
                      </div>
                    )}
                  </div>

                  {/* Auto-close status / Cooldown Message */}
                  <div className={`p-4 rounded-xl text-center mt-3 ${
                    cooldownMessage
                      ? 'bg-orange-50 border-2 border-orange-300'
                      : matchingResults.bestMatch.status === 'VIP'
                        ? 'bg-purple-50 border-2 border-purple-300'
                        : 'bg-green-50 border-2 border-green-300'
                  }`}>
                    {cooldownMessage ? (
                      <div className="space-y-1">
                        <div className="text-orange-600 font-medium">⏱️ Attendance Cooldown Active</div>
                        <div className="text-sm text-orange-700">{cooldownMessage}</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className={`font-medium ${
                          matchingResults.bestMatch.status === 'VIP' ? 'text-purple-600' : 'text-green-600'
                        }`}>
                          ✅ Attendance automatically logged
                        </div>
                        <div className="text-sm text-gray-600">
                          Auto-closing in {dialogCountdown} second{dialogCountdown !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )

            ) : (
              // ========== NO MATCH FOUND ==========
              <div>
                <h2 className="text-xl font-bold text-center text-orange-700 mb-4">
                  ❓ Face Not Recognized
                </h2>

                {/* TWO IMAGES SIDE BY SIDE */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* LEFT: Captured Image */}
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-600 mb-2">
                      Captured Photo
                    </div>
                    <img
                      src={capturedImage}
                      alt="Captured"
                      className="w-full h-48 object-cover rounded-xl border-2 border-orange-400 shadow-lg"
                    />
                  </div>

                  {/* RIGHT: No Match Icon */}
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium text-orange-600 mb-2">
                      No Match Found
                    </div>
                    <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-xl border-2 border-orange-300 shadow-lg">
                      <div className="text-center">
                        <div className="text-6xl mb-2">❓</div>
                        <div className="text-sm text-gray-600">Not in Database</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info message */}
                <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-200 mb-3">
                  <p className="text-sm text-orange-800 text-center">
                    This face is not registered in our system. Would you like to register as a new member?
                  </p>
                </div>

                {/* Action buttons */}
                <div className="space-y-3">
                  <button
                    onClick={onRegister}
                    className="w-full py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors shadow-lg"
                  >
                    ➕ Register as New Member
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </IonCardContent>
    </IonCard>
  );
};

export default UnifiedMatchingDialog;