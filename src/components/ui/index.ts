/**
 * Couche de design Direct Conseil. Tout composant d'interface passe par ici :
 * aucun style ad hoc dans les pages, aucune chaîne française codée en dur
 * dans les composants (les libellés viennent de `@/lib/i18n`).
 */

export { Alert, type AlertProps, type AlertTone } from "./Alert";
export { Avatar, type AvatarProps, type AvatarSize } from "./Avatar";
export { Badge, type BadgeProps, type Tone } from "./Badge";
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./Button";
export { Card, type CardProps } from "./Card";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Field, type FieldControlProps, type FieldProps } from "./Field";
export { Input, type InputProps } from "./Input";
export { Logo, type LogoProps } from "./Logo";
export { Modal, type ModalProps, type ModalSize } from "./Modal";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { Pagination, type PaginationProps } from "./Pagination";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { StatTile, type DeltaDirection, type StatTileProps, type StatTone } from "./StatTile";
export {
  StatusPill,
  type DomainStatus,
  type InvoiceStatus,
  type StatusKind,
  type StatusPillProps,
} from "./StatusPill";
export {
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type TableProps,
  type TDProps,
  type THProps,
  type TRProps,
} from "./Table";
export { Tabs, type TabItem, type TabsProps } from "./Tabs";
export { Textarea, type TextareaProps } from "./Textarea";
