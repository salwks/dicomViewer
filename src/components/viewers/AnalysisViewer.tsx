/**
 * Analysis Viewer Component
 * AI-enhanced DICOM viewer with analysis tools
 */

import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ThemeToggle } from '../ThemeToggle';

interface AnalysisViewerProps {
  // State props
  activeTool: string;

  // Handlers
  handleToolSelect: (tool: string) => void;
  onNavigateToMedicalViewer: () => void;
}

export const AnalysisViewer: React.FC<AnalysisViewerProps> = ({
  activeTool,
  handleToolSelect,
  onNavigateToMedicalViewer,
}) => {
  return (
    <div className='flex flex-col h-screen'>
      {/* Header */}
      <header className='bg-card border-b border-border px-6 py-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            <h1 className='text-xl font-semibold text-foreground'>AI Analysis</h1>
            <Badge variant="secondary">Advanced Mode</Badge>
          </div>
          <div className='flex items-center space-x-3'>
            <Button
              variant="outline"
              onClick={onNavigateToMedicalViewer}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Medical Viewer
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Tool Panel */}
        <div className='w-20 bg-card border-r border-border flex flex-col items-center py-4 space-y-1 overflow-y-auto'>
          {/* Navigation Tools */}
          <div className='text-xs text-muted-foreground mb-1'>Nav</div>
          <Button
            variant={activeTool === 'WindowLevel' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('WindowLevel')}
            title='Window/Level'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='12' cy='12' r='10' />
              <path d='M12 2a10 10 0 0 1 0 20' fill='currentColor' opacity='0.3' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Zoom' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Zoom')}
            title='Zoom'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='11' cy='11' r='8' />
              <path d='m21 21-4.35-4.35' />
              <line x1='11' y1='8' x2='11' y2='14' />
              <line x1='8' y1='11' x2='14' y2='11' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'Pan' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Pan')}
            title='Pan'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20' />
            </svg>
          </Button>

          {/* Measurement Tools */}
          <div className='text-xs text-muted-foreground mt-3 mb-1'>Measure</div>
          <Button
            variant={activeTool === 'Length' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('Length')}
            title='Length Measurement'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='4' y1='20' x2='20' y2='4' />
              <circle cx='4' cy='20' r='2' fill='currentColor' />
              <circle cx='20' cy='4' r='2' fill='currentColor' />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'RectangleROI' ? 'default' : 'outline'}
            size='icon'
            className='w-12 h-12'
            onClick={() => handleToolSelect('RectangleROI')}
            title='Rectangle ROI'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <rect x='4' y='4' width='16' height='16' rx='2' />
            </svg>
          </Button>

          {/* AI Analysis Tools */}
          <div className='text-xs text-muted-foreground mt-3 mb-1'>AI</div>
          <Button variant='outline' size='icon' className='w-12 h-12' title='AI Analysis'>
            🤖
          </Button>
          <Button variant='outline' size='icon' className='w-12 h-12' title='Statistics'>
            📊
          </Button>
        </div>

        {/* Main Viewer Area */}
        <div className='flex-1 bg-background p-4'>
          <Card className='h-full'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-lg'>AI-Enhanced DICOM Viewer</CardTitle>
            </CardHeader>
            <CardContent className='h-full flex items-center justify-center bg-muted/10'>
              <div className='text-center space-y-4'>
                <div className='text-6xl'>🧠</div>
                <h3 className='text-xl font-semibold'>AI Analysis Ready</h3>
                <p className='text-muted-foreground'>Load DICOM files to start AI-powered analysis</p>
                <Button>Start AI Analysis</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with Tabs */}
        <div className='w-80 bg-card border-l border-border'>
          <div className='p-4 border-b border-border'>
            <h2 className='text-lg font-semibold text-card-foreground'>AI Analysis Tools</h2>
          </div>

          <div className='p-4'>
            <Tabs defaultValue='analysis' className='w-full'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='analysis'>Analysis</TabsTrigger>
                <TabsTrigger value='reports'>Reports</TabsTrigger>
              </TabsList>

              <TabsContent value='analysis' className='space-y-4 mt-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Nodule Detection</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='flex justify-between text-sm'>
                      <span>Status:</span>
                      <Badge variant='outline'>Ready</Badge>
                    </div>
                    <div className='flex justify-between text-sm'>
                      <span>Confidence:</span>
                      <span className='text-muted-foreground'>--</span>
                    </div>
                    <Button className='w-full'>Run Detection</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Lesion Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='flex justify-between text-sm'>
                      <span>Detected:</span>
                      <span className='text-muted-foreground'>0 lesions</span>
                    </div>
                    <Button variant='outline' className='w-full'>
                      Analyze Lesions
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Measurements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant='outline' className='w-full'>
                      Auto Measure
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='reports' className='space-y-4 mt-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Analysis Report</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <p className='text-sm text-muted-foreground'>No analysis results yet</p>
                    <Button variant='outline' className='w-full'>
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Export Options</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-2'>
                    <Button variant='outline' className='w-full'>
                      Export PDF
                    </Button>
                    <Button variant='outline' className='w-full'>
                      Export DICOM SR
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};
