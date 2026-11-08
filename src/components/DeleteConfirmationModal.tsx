import React from 'react';
import { ConfirmationDialog, ConfirmationDialogProps } from './ConfirmationDialog';

export type DeleteConfirmationModalProps = ConfirmationDialogProps;

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = (props) => {
  return <ConfirmationDialog {...props} />;
};
