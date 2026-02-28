/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, 
  MessageSquare, 
  BarChart3, 
  Sparkles, 
  Search, 
  Calendar, 
  User,
  ChevronRight,
  Download,
  Trash2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format, startOfDay, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import JSZip from 'jszip';
import { parseWhatsAppChat, ChatMessage } from './utils/whatsappParser';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function App() {
  const [rawText, setRawText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [images, setImages] = useState<{ name: string, data: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'analytics' | 'ai' | 'images'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<{ name: string, data: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processText = (text: string) => {
    setRawText(text);
    const parsed = parseWhatsAppChat(text);
    if (parsed.length === 0) {
      alert("Aucun message n'a pu être extrait. \n\nAssurez-vous que :\n1. Le fichier est bien un export WhatsApp (.txt).\n2. Le format est standard (ex: '28/02/2024, 14:30 - Nom: Message').\n\nSi vous utilisez un ZIP, l'application cherche le fichier .txt à l'intérieur.");
    }
    setMessages(parsed);
  };

  const loadDemo = () => {
    const demoText = `[28/02/2024, 10:00:00] Alice: Salut ! Tu as vu le nouveau projet ?
[28/02/2024, 10:05:23] Bob: Oui, ça a l'air super intéressant ! On commence quand ?
[28/02/2024, 10:10:00] Alice: Lundi prochain. On doit préparer la présentation.
[01/03/2024, 09:00:00] Bob: Parfait, je m'en occupe ce weekend.
[01/03/2024, 14:30:00] Alice: Super, merci Bob !`;
    processText(demoText);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    console.log("Processing file:", file.name, "size:", file.size);

    if (file.name.endsWith('.zip')) {
      try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        
        // Look for the .txt file
        const txtFile = Object.values(contents.files).find(f => f.name.toLowerCase().endsWith('.txt') && !f.dir);
        if (txtFile) {
          console.log("Found text file in ZIP:", txtFile.name);
          const text = await txtFile.async('string');
          processText(text);
        }

        // Look for images
        const imageFiles = Object.values(contents.files).filter(f => 
          (f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpeg')) && !f.dir
        );
        
        console.log("Found images in ZIP:", imageFiles.length);
        const extractedImages = await Promise.all(imageFiles.map(async f => {
          const base64 = await f.async('base64');
          const mimeType = f.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          return { name: f.name, data: `data:${mimeType};base64,${base64}` };
        }));
        
        setImages(extractedImages);
        
        if (!txtFile && extractedImages.length === 0) {
          alert("Aucun contenu compatible (.txt ou images) trouvé dans le ZIP.");
        }
      } catch (error) {
        console.error("Error reading ZIP:", error);
        alert("Erreur lors de la lecture du fichier ZIP. Le fichier est peut-être corrompu.");
      } finally {
        setIsProcessingFile(false);
      }
    } else if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processText(text);
        setIsProcessingFile(false);
      };
      reader.onerror = () => {
        alert("Erreur lors de la lecture du fichier texte.");
        setIsProcessingFile(false);
      };
      reader.readAsText(file);
    } else {
      alert("Veuillez fournir un fichier .txt ou .zip.");
      setIsProcessingFile(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    setRawText(text);
    const parsed = parseWhatsAppChat(text);
    setMessages(parsed);
  };

  const filteredMessages = useMemo(() => {
    return messages.filter(m => 
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.sender.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  const stats = useMemo(() => {
    if (messages.length === 0) return null;

    const senderCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};
    
    messages.forEach(m => {
      senderCounts[m.sender] = (senderCounts[m.sender] || 0) + 1;
      const day = format(m.timestamp, 'yyyy-MM-dd');
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    const topSenders = Object.entries(senderCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const activityOverTime = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { topSenders, activityOverTime };
  }, [messages]);

  const runAIAnalysis = async () => {
    if (messages.length === 0) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      // Sample messages to avoid token limits but give context
      const sampleSize = 100;
      const sample = messages.slice(-sampleSize).map(m => `[${m.sender}]: ${m.content}`).join('\n');

      const prompt = `Voici un extrait d'une conversation WhatsApp. Peux-tu l'analyser et me donner :
      1. Un résumé des principaux sujets de discussion.
      2. Le ton général de la conversation (amical, formel, conflictuel, etc.).
      3. Les points clés ou décisions importantes prises (si applicable).
      4. Une liste de 3 faits amusants ou statistiques basés sur le contenu.
      
      Réponds en français avec un formatage Markdown élégant.
      
      EXTRAIT :
      ${sample}`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      setAiAnalysis(response.text || "Désolé, je n'ai pas pu analyser la conversation.");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiAnalysis("Erreur lors de l'analyse. Vérifiez votre clé API.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setImages([]);
    setRawText('');
    setAiAnalysis(null);
    setSearchQuery('');
    setEditingImage(null);
  };

  const handleEditImage = async () => {
    if (!editingImage || !editPrompt) return;
    setIsEditing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Data = editingImage.data.split(',')[1];
      const mimeType = editingImage.data.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: editPrompt,
            },
          ],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const newImageData = `data:image/png;base64,${part.inlineData.data}`;
          setEditingImage({ ...editingImage, data: newImageData });
          // Also update in the gallery
          setImages(prev => prev.map(img => img.name === editingImage.name ? { ...img, data: newImageData } : img));
          break;
        }
      }
      setEditPrompt('');
    } catch (error) {
      console.error("Image Edit Error:", error);
      alert("Erreur lors de la modification de l'image.");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-sm">
              <MessageSquare size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">ChatOrganize</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">WhatsApp Analyzer</p>
            </div>
          </div>
          
          {messages.length > 0 && (
            <div className="flex items-center gap-3">
              <button 
                onClick={reset}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Reset"
              >
                <Trash2 size={20} />
              </button>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['chat', 'analytics', 'ai', 'images'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                      activeTab === tab 
                        ? "bg-white text-emerald-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {tab === 'ai' ? 'IA' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto mt-12"
            >
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                  <Upload size={40} />
                </div>
                <h2 className="text-3xl font-bold mb-4 tracking-tight">Organisez vos conversations</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  Exportez votre chat WhatsApp au format .txt et glissez-le ici pour obtenir des analyses détaillées, 
                  des graphiques et des résumés intelligents.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessingFile ? (
                      <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mb-2" />
                    ) : (
                      <Download className="mb-2 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    )}
                    <span className="font-semibold text-slate-700">
                      {isProcessingFile ? "Traitement..." : "Choisir un fichier"}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">Format .txt ou .zip</span>
                  </button>
                  
                  <div className="relative">
                    <textarea
                      placeholder="Ou collez le texte ici..."
                      onPaste={handlePaste}
                      className="w-full h-full min-h-[120px] p-4 border-2 border-slate-100 rounded-2xl focus:border-emerald-400 focus:ring-0 transition-all text-sm resize-none bg-slate-50/50"
                    />
                  </div>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt,.zip" 
                  className="hidden" 
                />
                
                <div className="flex items-center justify-center gap-6 text-xs text-slate-400 font-medium uppercase tracking-widest">
                  <span className="flex items-center gap-1"><Sparkles size={14} /> IA Powered</span>
                  <span className="flex items-center gap-1"><BarChart3 size={14} /> Analytics</span>
                  <span className="flex items-center gap-1"><Search size={14} /> Smart Search</span>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                  <button 
                    onClick={loadDemo}
                    className="text-emerald-600 font-bold text-sm hover:underline"
                  >
                    Essayer avec des données d'exemple
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {activeTab === 'chat' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <Search className="text-slate-400" size={20} />
                    <input 
                      type="text"
                      placeholder="Rechercher dans la conversation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-400"
                    />
                    <div className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {filteredMessages.length} MESSAGES
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)]">
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
                      {filteredMessages.map((msg, idx) => {
                        const isNewDay = idx === 0 || !isSameDay(msg.timestamp, filteredMessages[idx-1].timestamp);
                        return (
                          <React.Fragment key={msg.id}>
                            {isNewDay && (
                              <div className="flex justify-center my-8">
                                <span className="px-4 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full uppercase tracking-widest">
                                  {format(msg.timestamp, 'EEEE d MMMM yyyy')}
                                </span>
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <div className="flex items-baseline gap-2">
                                <span className="font-bold text-sm text-emerald-600">{msg.sender}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{format(msg.timestamp, 'HH:mm')}</span>
                              </div>
                              <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100 max-w-[85%] inline-block">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <User size={20} className="text-emerald-500" />
                      Top Participants
                    </h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.topSenders}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {stats.topSenders.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {stats.topSenders.slice(0, 5).map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-medium text-slate-600">{s.name}</span>
                          </div>
                          <span className="font-bold">{s.value} msgs</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Calendar size={20} className="text-emerald-500" />
                      Activité dans le temps
                    </h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.activityOverTime}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(val) => format(new Date(val), 'dd/MM')}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="max-w-3xl mx-auto">
                  {!aiAnalysis && !isAnalyzing ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
                      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
                        <Sparkles size={32} />
                      </div>
                      <h3 className="text-2xl font-bold mb-4">Analyse Intelligente</h3>
                      <p className="text-slate-500 mb-8">
                        Laissez l'IA analyser votre conversation pour en extraire les points clés, 
                        le ton et les moments forts.
                      </p>
                      <button 
                        onClick={runAIAnalysis}
                        className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 mx-auto"
                      >
                        Lancer l'analyse <ChevronRight size={18} />
                      </button>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
                      <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-6" />
                      <h3 className="text-xl font-bold mb-2">Analyse en cours...</h3>
                      <p className="text-slate-400">Gemini parcourt vos messages pour vous offrir le meilleur résumé.</p>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Sparkles size={24} className="text-emerald-500" />
                          Insights de l'IA
                        </h3>
                        <button 
                          onClick={runAIAnalysis}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                        >
                          Réanalyser
                        </button>
                      </div>
                      <div className="prose prose-slate max-w-none">
                        <div className="markdown-body">
                          <Markdown>{aiAnalysis || ""}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {activeTab === 'images' && (
                <div className="space-y-6">
                  {images.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
                      <p className="text-slate-500">Aucune image trouvée dans l'export.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {images.map((img, idx) => (
                        <motion.div 
                          key={idx}
                          whileHover={{ scale: 1.02 }}
                          className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer group"
                          onClick={() => setEditingImage(img)}
                        >
                          <img 
                            src={img.data} 
                            alt={img.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Sparkles className="text-white" size={24} />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  <AnimatePresence>
                    {editingImage && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
                      >
                        <motion.div 
                          initial={{ scale: 0.9, y: 20 }}
                          animate={{ scale: 1, y: 0 }}
                          className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
                        >
                          <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-hidden">
                            <img 
                              src={editingImage.data} 
                              alt="Editing" 
                              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="w-full md:w-80 p-6 flex flex-col gap-6 border-l border-slate-100">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-lg">Éditeur IA</h3>
                              <button 
                                onClick={() => setEditingImage(null)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prompt de modification</label>
                              <textarea 
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                placeholder="Ex: 'Ajoute un filtre rétro' ou 'Enlève le fond'..."
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 h-32 resize-none"
                              />
                            </div>

                            <button 
                              onClick={handleEditImage}
                              disabled={isEditing || !editPrompt}
                              className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                            >
                              {isEditing ? (
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                              ) : (
                                <>Modifier avec Gemini <Sparkles size={16} /></>
                              )}
                            </button>

                            <div className="mt-auto pt-6 border-t border-slate-100">
                              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                Utilisez Gemini 2.5 Flash Image pour transformer vos souvenirs. Les modifications sont appliquées directement sur l'image sélectionnée.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
