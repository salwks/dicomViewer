import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ShadcnTestComponent: React.FC = () => {
  return (
    <div className='p-6 space-y-6'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>shadcn/ui 통합 테스트</CardTitle>
          <CardDescription>의료용 CSS 변수와 shadcn/ui 컴포넌트 호환성 검증</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Button Test */}
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Button 컴포넌트</h3>
            <div className='flex gap-2'>
              <Button>Primary</Button>
              <Button variant='secondary'>Secondary</Button>
              <Button variant='outline'>Outline</Button>
              <Button variant='destructive'>Destructive</Button>
            </div>
          </div>

          {/* Select Test */}
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Select 컴포넌트</h3>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder='모달리티 선택' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ct'>CT</SelectItem>
                <SelectItem value='mr'>MR</SelectItem>
                <SelectItem value='xr'>X-Ray</SelectItem>
                <SelectItem value='us'>Ultrasound</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Badge Test */}
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Badge 컴포넌트</h3>
            <div className='flex gap-2'>
              <Badge>Default</Badge>
              <Badge variant='secondary'>Secondary</Badge>
              <Badge variant='outline'>Outline</Badge>
              <Badge variant='destructive'>Critical</Badge>
            </div>
          </div>

          {/* Dialog Test */}
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Dialog 컴포넌트</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant='outline'>다이얼로그 열기</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>의료 이미징 설정</DialogTitle>
                  <DialogDescription>DICOM 뷰어 설정을 변경하시겠습니까?</DialogDescription>
                </DialogHeader>
                <div className='py-4'>
                  <p className='text-sm text-muted-foreground'>
                    CSS 변수가 정상적으로 적용되어 의료용 테마와 일치합니다.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShadcnTestComponent;
