"use client";
import React, { useState, useRef, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Image from 'next/image';
import { Upload, Download, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { uploadToCloudflare } from './service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const locations = ["Angkor Wat (Cambodia)",
  "Big Ben and Parliament (London, UK)",
  "Burj Khalifa (Dubai, UAE)",
  "Central Park (New York, USA)",
  "Christ the Redeemer (Rio de Janeiro, Brazil)",
"  Colosseum (Rome, Italy)",
  "Disney World (Orlando, USA)",
  "Eiffel Tower (Paris, France)",
  "Forbidden City (Beijing, China)",
  "Golden Gate Bridge (San Francisco, USA)",
  "Grand Canyon (Arizona, USA)",
  "Great Barrier Reef (Australia)",
  "Great Wall of China (China)",
  "Hagia Sophia (Istanbul, Turkey)",
  "Hollywood Walk of Fame (Los Angeles, USA)",
  "Leaning Tower of Pisa (Pisa, Italy)",
  "Louvre Museum (Paris, France)",
  "Machu Picchu (Peru)",
  "Mount Everest (Nepal/Tibet)",
  "Mount Fuji (Japan)",
  "Notre Dame Cathedral (Paris, France)",
  "Opera House (Sydney, Australia)",
  "Palace of Versailles (Versailles, France)",
  "Petra (Jordan)",
  "Pyramids of Giza (Egypt)",
  "Puerta de Alcalá (Madrid, Spain)",
  "Puerta de Brandeburgo (Berlin, Germany)",
  "Santorini (Greece)",
  "Sagrada Familia (Barcelona, Spain)",
  "Statue of Liberty (New York, USA)",
  "Stonehenge (England, UK)",
  "Taj Mahal (Agra, India)",
  "Times Square (New York, USA)",
  "Tokyo Tower (Tokyo, Japan)",
  "Uluru (Ayers Rock, Australia)",
  "Vatican Museums (Vatican City)",
  "Venice Canals (Venice, Italy)",
  "Victoria Falls (Zambia/Zimbabwe)",
  "Yellowstone National Park (USA)",
  "Yosemite National Park (USA)"]

const PaymentForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Payment form submitted');
    if (!stripe || !elements) return;

    setProcessing(true);
    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      console.error('Payment error:', submitError.message);
      setError(submitError.message || 'Payment failed');
      setProcessing(false);
    } else {
      console.log('Payment successful');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <Button type="submit" disabled={!stripe || processing} className="mt-4 w-full">
        {processing ? 'Processing...' : 'Pay for Image Processing'}
      </Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </form>
  );
};

const ImageMaskEditor = () => {
  const [image, setImage] = useState<string | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [prompt, setPrompt] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [hasPaid, setHasPaid] = useState(false); // New state to track if user has already paid
  const BRUSH_SIZE = 60;

  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskContextRef = useRef<CanvasRenderingContext2D | null>(null);  
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const initializeCanvases = (imageUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const maxWidth = 1024;
        const maxHeight = 1024;
        let newWidth = img.width;
        let newHeight = img.height;

        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = (img.height * maxWidth) / img.width;
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = (img.width * maxHeight) / img.height;
        }

        setImageSize({
          width: newWidth,
          height: newHeight
        });

        if (imageCanvasRef.current) {
          const imageCanvas = imageCanvasRef.current;
          const imageCtx = imageCanvas.getContext('2d');

          imageCanvas.width = newWidth;
          imageCanvas.height = newHeight;
          imageCtx?.drawImage(img, 0, 0, newWidth, newHeight);
        }

        if (maskCanvasRef.current) {
          const maskCanvas = maskCanvasRef.current;
          const maskCtx = maskCanvas.getContext('2d');

          maskCanvas.width = newWidth;
          maskCanvas.height = newHeight;
          if (maskCtx) {
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, newWidth, newHeight);
            maskCtx.fillStyle = 'black';
            maskCtx.lineWidth = BRUSH_SIZE;
            maskCtx.lineCap = 'round';
            maskCtx.lineJoin = 'round';
            maskCtx.strokeStyle = 'black';
          }

          maskContextRef.current = maskCtx;
          resolve();
        }
      };
      img.src = imageUrl;
    });
  };

  const clearMask = () => {
    console.log('Clear mask clicked');
    if (maskCanvasRef.current && maskContextRef.current) {
      const ctx = maskContextRef.current;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      ctx.fillStyle = 'black';
      setMask(null);
    }
  };

  useEffect(() => {
    if (image) {
      console.log('Image uploaded:', image);
      initializeCanvases(image);
    }
  }, [image]);

  const handleCursorLeave = () => {
    setShowCursor(false);
    isDrawing.current = false; // Stop drawing when cursor leaves canvas
    console.log('Cursor left canvas');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Image file selected:', file.name);
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size should be less than 10MB');
        console.error('Image size exceeds 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          setImage(event.target.result as string);
        }
        setError(null);
      };
      reader.onerror = () => {
        setError('Error reading file');
        console.error('Error reading file');
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imageUrl: string, maskUrl: string) => {
    setIsProcessing(true);
    setError(null);
    console.log('Processing image with prompt:', prompt);
  
    try {
      const response = await fetch('/api/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: "95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3",
          input: {
            image: imageUrl,
            mask: maskUrl,
            prompt: prompt,
            num_inference_steps: 25,
          },
        }),
      });
  
      if (!response.ok) throw new Error('Failed to process image');
  
      const data = await response.json();
      console.log('Response:', data);
      if (Array.isArray(data) && data.length > 0) {
        setResult(data[0]);
        console.log('Result:', data[0]);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to process image');
        console.error('Error processing image:', err.message);
      } else {
        setError('Failed to process image');
        console.error('Unknown error processing image');
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handlePaymentAndProcessImage = async () => {
    if (!image || !mask || !prompt) {
      setError('Please provide an image, mask, and prompt.');
      console.error('Missing image, mask, or prompt');
      return;
    }
  
    setError(null);
    console.log('Preparing image and mask for processing');
  
    try {
      const imageBlob = await fetch(image).then((res) => res.blob());
      const maskBlob = await fetch(mask).then((res) => res.blob());
  
      const imageFile = new File([imageBlob], 'image.png', { type: imageBlob.type });
      const maskFile = new File([maskBlob], 'mask.png', { type: maskBlob.type });
  
      const imageUrl = await uploadToCloudflare(imageFile);
      const maskUrl = await uploadToCloudflare(maskFile);
  
      if (!hasPaid) {
        // Create payment intent first
        console.log('Creating payment intent');
        const paymentResponse = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 500 }), // $5.00 for image processing
        });
  
        const { clientSecret: secret } = await paymentResponse.json();
        setClientSecret(secret);
        console.log('Payment intent created, client secret:', secret);
      } else {
        // Process image if already paid
        console.log('User has already paid, processing image');
        processImage(imageUrl, maskUrl);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to prepare image for processing');
        console.error('Error preparing image for processing:', err.message);
      } else {
        setError('Failed to prepare image for processing');
        console.error('Unknown error preparing image for processing');
      }
    }
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    console.log('Downloading image:', filename);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Removed unused downloadMask function

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskContextRef.current) return;
    e.preventDefault(); // Prevent unwanted behaviors
    console.log('Start drawing');
    
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    isDrawing.current = true;
    lastPoint.current = { x, y };
    
    const ctx = maskContextRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const updateCursorPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskCanvasRef.current) return;
    
    const canvas = maskCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCursorPosition({ x, y });
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent unwanted behaviors
    updateCursorPosition(e);
    
    if (!isDrawing.current || !maskContextRef.current) return;

    const canvas = maskCanvasRef.current;
    const ctx = maskContextRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.beginPath();
    if (lastPoint.current) {
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    }
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPoint.current = { x, y };
  };

  const handleCursorEnter = () => {
    setShowCursor(true);
    console.log('Cursor entered canvas');
  };

  const stopDrawing = () => {
    setMask(maskCanvasRef.current?.toDataURL() || null);
    if (maskCanvasRef.current) {
      setMask(maskCanvasRef.current.toDataURL());
    }
    console.log('Stop drawing');
  };

  const downloadResult = () => {
    if (!result) return;
    console.log('Downloading result image');
    downloadImage(result, 'result.png');
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Image Mask Editor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!image ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <ImageIcon className="w-12 h-12 mb-2 text-gray-400" />
                <span>Click to upload an image (max 10MB)</span>
              </label>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="relative border rounded-lg overflow-hidden">
                  <canvas
                    ref={imageCanvasRef}
                    style={{
                      maxWidth: '100%',
                      width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
                      height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  />
                  <div 
                    className="relative"
                    style={{
                      width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
                      height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto',
                    }}
                  >
                    <canvas
                      ref={maskCanvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={handleCursorLeave}
                      onMouseEnter={handleCursorEnter}
                      style={{
                        maxWidth: '100%',
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        zIndex: 1,
                        opacity: 0.5,
                      }}
                    />
                    {showCursor && (
                      <div
                        className="pointer-events-none absolute border-2 border-white rounded-full"
                        style={{
                          width: `${BRUSH_SIZE}px`,
                          height: `${BRUSH_SIZE}px`,
                          transform: `translate(${cursorPosition.x - BRUSH_SIZE/2}px, ${cursorPosition.y - BRUSH_SIZE/2}px)`,
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          zIndex: 2,
                        }}
                      />
                    )}
                  </div>
                </div>

                <Select
                  value={prompt}
                  onValueChange={(value: string) => {
                    setPrompt(value);
                    console.log('Prompt changed:', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location, index) => (
                      <SelectItem key={index} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    onClick={clearMask}
                    variant="outline"
                    className="flex-1"
                    disabled={!mask}
                  >
                    Clear Mask
                  </Button>
                </div>

                <div className="flex gap-2">
                  {clientSecret && !paid ? (
                    <div className="w-full">
                      <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <PaymentForm onSuccess={() => {
                          setPaid(true);
                          setHasPaid(true); // Set hasPaid to true after successful payment
                          handlePaymentAndProcessImage();
                        }} />
                      </Elements>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handlePaymentAndProcessImage()}
                      disabled={isProcessing || !mask || !prompt}
                      className="w-full"
                    >
                      {isProcessing ? 'Processing...' : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Process Image {hasPaid ? '' : '($5.00)'}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {result && (
                  <>
                    <Image
                      src={result}
                      alt="Processed result"
                      className="w-full rounded-lg"
                      width={imageSize.width}
                      height={imageSize.height}
                    />
                    <Button onClick={downloadResult} className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Download Result
                    </Button>
                  </>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ImageMaskEditor;
