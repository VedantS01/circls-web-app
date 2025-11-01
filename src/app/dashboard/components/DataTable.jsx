'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography,
  Box,
} from '@mui/material';
import { MoreVert, Edit, Delete, Person } from '@mui/icons-material';
import { useState } from 'react';

export default function DataTable({ 
  columns, 
  rows, 
  onEdit, 
  onDelete,
  emptyMessage = 'No data available' 
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const handleMenuOpen = (event, row) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleEdit = () => {
    onEdit?.(selectedRow);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete?.(selectedRow);
    handleMenuClose();
  };

  if (rows.length === 0) {
    return (
      <Paper 
        elevation={0} 
        sx={{ 
          border: 1, 
          borderColor: 'divider', 
          p: 4, 
          textAlign: 'center' 
        }}
      >
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Paper>
    );
  }

  return (
    <>
      <TableContainer 
        component={Paper} 
        elevation={0}
        sx={{ border: 1, borderColor: 'divider' }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {columns.map((column) => (
                <TableCell 
                  key={column.id}
                  sx={{ fontWeight: 600, color: 'text.secondary' }}
                >
                  {column.label}
                </TableCell>
              ))}
              {(onEdit || onDelete) && (
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: 60 }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow 
                key={row.id || index}
                sx={{ 
                  '&:hover': { bgcolor: 'grey.50' },
                  '&:last-child td': { border: 0 }
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.id}>
                    {column.render ? column.render(row[column.id], row) : row[column.id]}
                  </TableCell>
                ))}
                {(onEdit || onDelete) && (
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={(e) => handleMenuOpen(e, row)}
                    >
                      <MoreVert fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {onEdit && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            Edit
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            Delete
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export function AvatarCell({ name, subtitle, avatarUrl }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Avatar 
        src={avatarUrl} 
        alt={name}
        sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
      >
        {name?.charAt(0)?.toUpperCase() || <Person />}
      </Avatar>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {name}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function StatusChip({ status, label }) {
  const colorMap = {
    active: 'success',
    pending: 'warning',
    inactive: 'default',
    verified: 'success',
    unverified: 'warning',
    accepted: 'success',
    expired: 'error',
  };

  return (
    <Chip 
      label={label || status} 
      size="small"
      color={colorMap[status] || 'default'}
      sx={{ fontWeight: 500 }}
    />
  );
}
