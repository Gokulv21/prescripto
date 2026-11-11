import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Eraser, PenTool, Save, Trash2, Upload, Pencil, X, 
    Undo, Redo, MousePointer2 
} from 'lucide-react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogFooter, DialogOverlay, DialogPortal 
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getStroke } from 'perfect-freehand';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface SignaturePadProps {
    onSave: (signature: string) => void;
    initialSignature?: string;
    disabled?: boolean;
}

export default function SignaturePad({ onSave, initialSignature, disabled = false }: SignaturePadProps) {
    const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            onSave(result);
            toast.success('Signature uploaded successfully');
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Button 
                    type="button" 
                    variant="outline" 
                    disabled={disabled}
                    className="h-24 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50 flex flex-col gap-2 transition-all group disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                    onClick={() => !disabled && fileInputRef.current?.click()}
                >
                    <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-blue-100 transition-colors">
                        <Upload className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-700">Upload Image</span>
                </Button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    disabled={disabled}
                    onChange={handleFileUpload} 
                />

                <Button 
                    type="button" 
                    variant="outline" 
                    disabled={disabled}
                    className="h-24 rounded-2xl border-2 border-dashed border-slate-200 hover:border-purple-500 hover:bg-purple-50 flex flex-col gap-2 transition-all group disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                    onClick={() => !disabled && setIsDrawModalOpen(true)}
                >
                    <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-purple-100 transition-colors">
                        <Pencil className="w-5 h-5 text-slate-500 group-hover:text-purple-600" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-purple-700">Draw with Pen</span>
                </Button>
            </div>

            <DrawSignatureModal 
                isOpen={isDrawModalOpen} 
                onClose={() => setIsDrawModalOpen(false)} 
                onSave={(data) => {
                    onSave(data);
                    setIsDrawModalOpen(false);
                }} 
            />
        </div>
    );
}

// Sub-component for the drawing overlay to keep main cleaner
function DrawSignatureModal({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (data: string) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [paths, setPaths] = useState<any[]>([]);
    const [history, setHistory] = useState<any[][]>([[]]);
    const [historyStep, setHistoryStep] = useState(0);
    const isDrawingRef = useRef(false);
    const currentPathRef = useRef<any[]>([]);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        paths.forEach(path => {
            const stroke = getStroke(path.points, {
                size: 3.5,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
            });

            if (stroke.length === 0) return;
            ctx.beginPath();
            ctx.fillStyle = '#000000';
            ctx.moveTo(stroke[0][0], stroke[0][1]);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i][0], stroke[i][1]);
            }
            ctx.fill();
        });
    }, [paths]);

    useEffect(() => {
        if (isOpen) {
            // Wait for dialog to open before setting canvas size
            setTimeout(() => {
                const canvas = canvasRef.current;
                const container = containerRef.current;
                if (canvas && container) {
                    canvas.width = container.clientWidth * 2;
                    canvas.height = container.clientHeight * 2;
                    redraw();
                }
            }, 100);
        }
    }, [isOpen, redraw]);

    useEffect(() => {
        redraw();
    }, [paths, redraw]);

    const getPos = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return [
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY,
            e.pressure || 0.5
        ];
    };

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        isDrawingRef.current = true;
        currentPathRef.current = [getPos(e)];
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        currentPathRef.current.push(getPos(e));
        
        // Optimistic draw for current path
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const stroke = getStroke(currentPathRef.current, {
            size: 3.5,
            thinning: 0.5,
        });
        if (stroke.length > 0) {
            ctx.beginPath();
            ctx.fillStyle = '#000000';
            ctx.moveTo(stroke[0][0], stroke[0][1]);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i][0], stroke[i][1]);
            }
            ctx.fill();
        }
    };

    const onPointerUp = () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        
        const newPaths = [...paths, { points: currentPathRef.current }];
        setPaths(newPaths);
        
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newPaths);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        currentPathRef.current = [];
    };

    const undo = () => {
        if (historyStep > 0) {
            const nextStep = historyStep - 1;
            setHistoryStep(nextStep);
            setPaths(history[nextStep]);
        }
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas || paths.length === 0) {
            toast.error('Please draw a signature first');
            return;
        }

        // Create a temporary canvas with exact background for clean PNG
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
            // Draw paths onto temp canvas
            paths.forEach(path => {
                const stroke = getStroke(path.points, { size: 4 });
                if (stroke.length > 0) {
                    tctx.beginPath();
                    tctx.fillStyle = '#000000';
                    tctx.moveTo(stroke[0][0], stroke[0][1]);
                    for (let i = 1; i < stroke.length; i++) tctx.lineTo(stroke[i][0], stroke[i][1]);
                    tctx.fill();
                }
            });
            onSave(tempCanvas.toDataURL('image/png'));
            toast.success('Signature captured');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden border-none bg-slate-100 rounded-[2rem] shadow-2xl">
                <div className="flex flex-col h-[70vh] md:h-[60vh]">
                    <div className="p-6 bg-white border-b flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-slate-900">Draw Digital Signature</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Use your Pen or Stylus for best quality</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div ref={containerRef} className="flex-1 relative bg-white m-6 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden shadow-inner">
                        <canvas 
                            ref={canvasRef}
                            style={{ width: '100%', height: '100%', touchAction: 'none' }}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                            className="relative z-10"
                        />
                        
                        {/* Paper Aesthetics: Signature Line */}
                        <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 pointer-events-none opacity-20 z-0">
                            <div className="w-[80%] h-[2px] bg-slate-900 relative">
                                <span className="absolute -top-12 left-0 text-4xl font-serif">X</span>
                            </div>
                        </div>

                        <div className="absolute top-4 right-4 flex gap-2 z-20">
                             <Button variant="secondary" size="sm" onClick={undo} disabled={historyStep === 0} className="rounded-xl h-10 px-4 gap-2 bg-white/80 backdrop-blur">
                                <Undo className="w-4 h-4" /> Undo
                             </Button>
                             
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="secondary" size="sm" className="rounded-xl h-10 px-4 gap-2 text-red-500 bg-white/80 backdrop-blur">
                                        <Trash2 className="w-4 h-4" /> Clear
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <div className="flex items-center gap-3 text-red-600 mb-2">
                                            <AlertTriangle className="w-6 h-6" />
                                            <AlertDialogTitle className="text-xl font-black">Clear Signature?</AlertDialogTitle>
                                        </div>
                                        <AlertDialogDescription className="text-slate-500 font-bold">
                                            This will permanently delete your current drawing. You will have to start over.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2 sm:gap-0">
                                        <AlertDialogCancel className="rounded-full font-bold border-slate-200">Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                            onClick={() => { setPaths([]); setHistory([[]]); setHistoryStep(0); }}
                                            className="rounded-full font-black uppercase tracking-widest text-[10px] bg-red-600 hover:bg-red-700 text-white px-6"
                                        >
                                            Yes, Clear Everything
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                             </AlertDialog>
                        </div>
                        {paths.length === 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-10 z-0">
                                <PenTool className="w-24 h-24 mb-4" />
                                <p className="font-black uppercase tracking-[0.4em] text-xl">Sign Above the Line</p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 flex justify-end gap-3">
                        <Button variant="ghost" onClick={onClose} className="font-bold">Cancel</Button>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] px-8 rounded-full h-12 shadow-lg shadow-blue-100">
                             Confirm Signature
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
