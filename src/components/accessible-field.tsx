import { Children, cloneElement, isValidElement, useId, type ReactNode, type ReactElement } from 'react';
import { Label } from '@/components/ui/label';

/** Associate labels with nested native and Radix controls, including paired amount/currency fields. */
export function AccessibleField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  let first = true;
  function associate(nodes: ReactNode): ReactNode {
    return Children.map(nodes, child => {
      if (!isValidElement(child)) return child;
      const element = child as ReactElement<{ children?: ReactNode; id?: string; 'aria-label'?: string; 'aria-labelledby'?: string }>;
      const props = element.props;
      if (props.children) return cloneElement(element, {}, associate(props.children));
      if (props['aria-label']) return child;
      const controlId = first ? id : `${id}-additional`;
      first = false;
      return cloneElement(element, { id: props.id ?? controlId, 'aria-labelledby': `${id}-label` });
    });
  }
  return <div className="space-y-1.5"><Label id={`${id}-label`} htmlFor={id}>{label}</Label>{associate(children)}</div>;
}