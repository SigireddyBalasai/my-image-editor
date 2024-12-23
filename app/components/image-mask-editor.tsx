"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

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
  const BRUSH_SIZE = 60;

  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskContextRef = useRef<CanvasRenderingContext2D | null>(null);  
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const CLOUD_FLARE_API_URL = "https://api.cloudflare.com/client/v4/accounts/114369a2af575013e09a86cf35e99477/images/v1";
  const CLOUD_FLARE_API_TOKEN = "p_sctF4Nt8j9Q359O0jtmh6XMd35fjpKhFyeBQu2";

  const initializeCanvases = (imageUrl: string): Promise<void> => {
    console.log('Initializing canvases with image URL:', imageUrl);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        console.log('Image loaded:', img);
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
            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, newWidth, newHeight);
            maskCtx.fillStyle = 'white';
            maskCtx.lineWidth = BRUSH_SIZE;
            maskCtx.lineCap = 'round';
            maskCtx.lineJoin = 'round';
            maskCtx.strokeStyle = 'white';
          }

          maskContextRef.current = maskCtx;
          resolve();
        }
      };
      img.src = imageUrl;
    });
  };

  const clearMask = () => {
    console.log('Clearing mask');
    if (maskCanvasRef.current && maskContextRef.current) {
      const ctx = maskContextRef.current;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      ctx.fillStyle = 'white';
      setMask(null);
    }
  };

  useEffect(() => {
    if (image) {
      console.log('Image state updated:', image);
      initializeCanvases(image);
    }
  }, [image]);

  const handleCursorLeave = () => {
    console.log('Cursor left canvas');
    setShowCursor(false);
    isDrawing.current = false; // Stop drawing when cursor leaves canvas
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files[0];
    if (file) {
      console.log('Image file selected:', file);
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size should be less than 10MB');
        console.error('Image size exceeds 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        console.log('Image file read successfully');
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
  const uploadToCloudflare = async (fileData: Blob) => {
    console.log('Uploading to Cloudflare');
    const formData = new FormData();
    formData.append("file", fileData);

    try {
      const response = await fetch(CLOUD_FLARE_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUD_FLARE_API_TOKEN}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to upload to Cloudflare:', errorData);
        throw new Error(errorData.errors?.[0]?.message || 'Failed to upload to Cloudflare');
      }

      const data = await response.json();
      console.log('Upload to Cloudflare successful:', data);
      return data.result.variants[0];
    } catch (err) {
      setError(err.message || 'Failed to upload to Cloudflare');
      console.error('Error uploading to Cloudflare:', err);
      throw err;
    }
  };

  const processImage = async () => {
    console.log('Processing image');
    if (!image || !mask || !prompt) {
      setError('Please provide an image, mask, and prompt.');
      console.error('Missing image, mask, or prompt');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const imageBlob = await fetch(image).then((res) => res.blob());
      const maskBlob = await fetch(mask).then((res) => res.blob());

      const imageUrl = await uploadToCloudflare(imageBlob);
      const maskUrl = await uploadToCloudflare(maskBlob);

      const response = await fetch('/api/replicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to process image:', errorData);
        throw new Error(errorData.message || 'Failed to process image');
      }

      const data = await response.json();
      if (!data.output) {
        console.error('No output received from the server');
        throw new Error('No output received from the server');
      }
      console.log('Image processed successfully:', data);
      setResult(data.output);
    } catch (err) {
      setError(err.message || 'Failed to process image. Please try again.');
      console.error('Error processing image:', err);
    } finally {
      setIsProcessing(false);
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

  const downloadMask = () => {
    if (!mask) return;
    console.log('Downloading mask');
    downloadImage(mask, 'mask.png');
  };
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskContextRef.current) return;
    e.preventDefault(); // Prevent unwanted behaviors
    
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
    console.log('Started drawing at:', { x, y });
  }

  const updateCursorPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskCanvasRef.current) return;
    
    const canvas = maskCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCursorPosition({ x, y });
    console.log('Cursor position updated:', { x, y });
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
    console.log('Drawing at:', { x, y });
  };

  const handleCursorEnter = () => {
    console.log('Cursor entered canvas');
    setShowCursor(true);
  };

  const stopDrawing = () => {
    console.log('Stopped drawing');
      setMask(maskCanvasRef.current?.toDataURL() || null);
    if (maskCanvasRef.current) {
      setMask(maskCanvasRef.current.toDataURL());
    }
  };

  const downloadResult = () => {
    if (!result) return;
    console.log('Downloading result');
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
              <Tabs defaultValue="edit">
                <TabsList className="mb-4">
                  <TabsTrigger value="edit">Create Mask</TabsTrigger>
                  <TabsTrigger value="result">Result</TabsTrigger>
                </TabsList>
                
                <TabsContent value="edit">
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

                    <Input
                      placeholder="Enter prompt (e.g., 'Face of a yellow cat')"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full"
                    />

                    <div className="flex gap-2">
                      <Button
                        onClick={clearMask}
                        variant="outline"
                        className="flex-1"
                      >
                        Clear Mask
                      </Button>
                      <Button
                        onClick={downloadMask}
                        variant="outline"
                        className="flex-1"
                        disabled={!mask}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Mask
                      </Button>
                    </div>

                    <Button
                      onClick={processImage}
                      disabled={isProcessing || !mask || !prompt}
                      className="w-full"
                    >
                      {isProcessing ? (
                        'Processing...'
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Process Image
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="result">
                  {result ? (
                    <div className="space-y-4">
                      <img
                        src={result}
                        alt="Processed result"
                        className="w-full rounded-lg"
                      />
                      <Button onClick={downloadResult} className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download Result
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      Process an image to see the result
                    </div>
                  )}
                </TabsContent>
              </Tabs>

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