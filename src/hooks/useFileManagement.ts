/**
 * File Management Hook
 * Handles DICOM file loading and series management
 */
import { log } from '../utils/logger';

import { useCallback } from 'react';
import { simpleDicomLoader } from '../services/simpleDicomLoader';
interface UseFileManagementProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setIsLoading: (loading: boolean) => void;
  setSeriesData: (data: any[]) => void;
  seriesData: any[];
  selectedSeries: number;
  setSelectedSeries: (index: number) => void;
}

export const useFileManagement = ({
  fileInputRef,
  setIsLoading,
  setSeriesData,
  seriesData,
  selectedSeries,
  setSelectedSeries,
}: UseFileManagementProps) => {
  // Load DICOM files
  const handleFileLoad = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsLoading(true);
      try {
        await simpleDicomLoader.loadFiles(Array.from(files));
        const series = await simpleDicomLoader.getSeriesData();
        setSeriesData(series);
        log.info('Loaded series data:', series);
      } catch (error) {
        console.error('Error loading DICOM files:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [setIsLoading, setSeriesData],
  );

  // Handle load files button click
  const handleLoadFilesClick = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  // Handle series selection
  const handleSeriesSelect = useCallback(
    (index: number) => {
      setSelectedSeries(index);
    },
    [setSelectedSeries],
  );

  // Handle series deletion
  const handleSeriesDelete = useCallback(
    (indexToDelete: number, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent triggering series selection

      const newSeriesData = seriesData.filter((_, index) => index !== indexToDelete);
      setSeriesData(newSeriesData);

      // Adjust selected series if needed
      if (selectedSeries === indexToDelete) {
        // If deleting the selected series, select the first available or none
        setSelectedSeries(newSeriesData.length > 0 ? 0 : 0);
      } else if (selectedSeries > indexToDelete) {
        // If deleting a series before the selected one, adjust the index
        setSelectedSeries(selectedSeries - 1);
      }
    },
    [seriesData, selectedSeries, setSeriesData, setSelectedSeries],
  );

  return {
    handleFileLoad,
    handleLoadFilesClick,
    handleSeriesSelect,
    handleSeriesDelete,
  };
};
