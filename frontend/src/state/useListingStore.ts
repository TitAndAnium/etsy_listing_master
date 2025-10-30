import * as React from 'react';

export type InputMode = 'name' | 'short' | 'dump';
export type FieldType = 'title' | 'description' | 'tags';

export interface FieldState {
  value: string | string[];
  retryReason: string;
  warnings: string[];
  copyEnabled: boolean;
}

export interface TagsFieldState extends FieldState {
  value: string[];
  invalid?: string[];
}

export interface TargetingState {
  audience?: string;
  ageBracket?: '18-24' | '25-34' | '35-44' | '45-54' | '55+' | 'custom';
  niche?: string;
  toneProfile?: string;
  giftMode: boolean;
  giftEmotion?: string;
}

export interface ContextState {
  aiFields: Record<string, unknown>;
  userOverrides: Record<string, unknown>;
  requiredFields: string[];
  confirmedByUser: boolean;
}

export interface ListingState {
  inputMode: InputMode;
  activeField: FieldType;
  title: FieldState;
  description: FieldState;
  tags: TagsFieldState;
  targeting: TargetingState;
  context: ContextState;
}

function createFieldState(): FieldState {
  return {
    value: '',
    retryReason: '',
    warnings: [],
    copyEnabled: false,
  };
}

function createTagsFieldState(): TagsFieldState {
  return {
    value: Array(13).fill(''),
    retryReason: '',
    warnings: [],
    copyEnabled: false,
    invalid: [],
  };
}

const initialContextState: ContextState = {
  aiFields: {},
  userOverrides: {},
  requiredFields: [],
  confirmedByUser: false,
};

export const initialListingState: ListingState = {
  inputMode: 'short',
  activeField: 'title',
  title: createFieldState(),
  description: createFieldState(),
  tags: createTagsFieldState(),
  targeting: {
    giftMode: false,
  },
  context: initialContextState,
};

type Action =
  | { type: 'SET_INPUT_MODE'; payload: InputMode }
  | { type: 'SET_ACTIVE_FIELD'; payload: FieldType }
  | { type: 'UPSERT_FIELD'; payload: { field: FieldType; value: string | string[]; retryReason?: string; warnings?: string[]; invalid?: string[] } }
  | { type: 'SET_TARGETING'; payload: Partial<TargetingState> }
  | { type: 'SET_AI_FIELDS'; payload: Record<string, unknown> }
  | { type: 'PATCH_AI_FIELDS'; payload: Record<string, unknown> }
  | { type: 'PATCH_USER_OVERRIDES'; payload: Record<string, unknown> }
  | { type: 'RESET_USER_OVERRIDES' }
  | { type: 'SET_REQUIRED_FIELDS'; payload: string[] }
  | { type: 'SET_CONFIRMED_BY_USER'; payload: boolean }
  | { type: 'RESET_CONTEXT' }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; payload: ListingState };

function deriveCopyEnabled(field: FieldType, state: FieldState | TagsFieldState): boolean {
  if (state.retryReason) return false;

  if (field === 'title') {
    const value = typeof state.value === 'string' ? state.value : '';
    return value.length > 0 && value.length <= 140;
  }

  if (field === 'description') {
    const value = typeof state.value === 'string' ? state.value : '';
    return value.trim().length > 0;
  }

  const tagsValue = Array.isArray(state.value) ? state.value : [];
  if (tagsValue.length !== 13) return false;
  return tagsValue.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= 20);
}

function listingReducer(state: ListingState, action: Action): ListingState {
  switch (action.type) {
    case 'SET_INPUT_MODE':
      return { ...state, inputMode: action.payload };
    case 'SET_ACTIVE_FIELD':
      return { ...state, activeField: action.payload };
    case 'SET_TARGETING':
      return { ...state, targeting: { ...state.targeting, ...action.payload } };
    case 'SET_AI_FIELDS':
      return {
        ...state,
        context: {
          ...state.context,
          aiFields: { ...action.payload },
        },
      };
    case 'PATCH_AI_FIELDS':
      return {
        ...state,
        context: {
          ...state.context,
          aiFields: { ...state.context.aiFields, ...action.payload },
        },
      };
    case 'PATCH_USER_OVERRIDES':
      return {
        ...state,
        context: {
          ...state.context,
          userOverrides: { ...state.context.userOverrides, ...action.payload },
        },
      };
    case 'RESET_USER_OVERRIDES':
      return {
        ...state,
        context: {
          ...state.context,
          userOverrides: {},
        },
      };
    case 'SET_REQUIRED_FIELDS':
      return {
        ...state,
        context: {
          ...state.context,
          requiredFields: [...action.payload],
        },
      };
    case 'SET_CONFIRMED_BY_USER':
      return {
        ...state,
        context: {
          ...state.context,
          confirmedByUser: action.payload,
        },
      };
    case 'RESET_CONTEXT':
      return {
        ...state,
        context: initialContextState,
      };
    case 'RESET':
      return {
        ...initialListingState,
        title: createFieldState(),
        description: createFieldState(),
        tags: createTagsFieldState(),
      };
    case 'HYDRATE':
      return action.payload;
    case 'UPSERT_FIELD': {
      const { field, value, retryReason = '', warnings = [], invalid = [] } = action.payload;
      const previousField = field === 'tags' ? state.tags : state[field];
      const updatedField: FieldState | TagsFieldState = {
        ...previousField,
        value,
        retryReason,
        warnings,
      };
      const copyEnabled = deriveCopyEnabled(field, updatedField);
      updatedField.copyEnabled = copyEnabled;

      if (field === 'tags') {
        return {
          ...state,
          tags: {
            ...(updatedField as TagsFieldState),
            invalid,
          },
        };
      }

      return {
        ...state,
        [field]: updatedField,
      } as ListingState;
    }
    default:
      return state;
  }
}

export interface ListingStoreValue {
  state: ListingState;
  actions: {
    setInputMode: (mode: InputMode) => void;
    setActiveField: (field: FieldType) => void;
    setField: (
      field: FieldType,
      payload: { value: string | string[]; retryReason?: string; warnings?: string[]; invalid?: string[] },
    ) => void;
    setTargeting: (payload: Partial<TargetingState>) => void;
    setAiFields: (fields: Record<string, unknown>) => void;
    patchAiFields: (fields: Record<string, unknown>) => void;
    patchUserOverrides: (overrides: Record<string, unknown>) => void;
    resetUserOverrides: () => void;
    setRequiredFields: (fields: string[]) => void;
    setConfirmedByUser: (confirmed: boolean) => void;
    resetContext: () => void;
    reset: () => void;
    hydrate: (next: ListingState) => void;
  };
}

const ListingStoreContext = React.createContext<ListingStoreValue | undefined>(undefined);

export function ListingStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(listingReducer, initialListingState);

  const actions = React.useMemo(
    () => ({
      setInputMode: (mode: InputMode) => dispatch({ type: 'SET_INPUT_MODE', payload: mode }),
      setActiveField: (field: FieldType) => dispatch({ type: 'SET_ACTIVE_FIELD', payload: field }),
      setField: (
        field: FieldType,
        payload: { value: string | string[]; retryReason?: string; warnings?: string[]; invalid?: string[] },
      ) => dispatch({ type: 'UPSERT_FIELD', payload: { field, ...payload } }),
      setTargeting: (payload: Partial<TargetingState>) => dispatch({ type: 'SET_TARGETING', payload }),
      setAiFields: (fields: Record<string, unknown>) => dispatch({ type: 'SET_AI_FIELDS', payload: fields }),
      patchAiFields: (fields: Record<string, unknown>) => dispatch({ type: 'PATCH_AI_FIELDS', payload: fields }),
      patchUserOverrides: (overrides: Record<string, unknown>) =>
        dispatch({ type: 'PATCH_USER_OVERRIDES', payload: overrides }),
      resetUserOverrides: () => dispatch({ type: 'RESET_USER_OVERRIDES' }),
      setRequiredFields: (fields: string[]) => dispatch({ type: 'SET_REQUIRED_FIELDS', payload: fields }),
      setConfirmedByUser: (confirmed: boolean) => dispatch({ type: 'SET_CONFIRMED_BY_USER', payload: confirmed }),
      resetContext: () => dispatch({ type: 'RESET_CONTEXT' }),
      reset: () => dispatch({ type: 'RESET' }),
      hydrate: (next: ListingState) => dispatch({ type: 'HYDRATE', payload: next }),
    }),
    [],
  );

  const value = React.useMemo<ListingStoreValue>(() => ({ state, actions }), [state, actions]);

  return React.createElement(ListingStoreContext.Provider, { value }, children);
}

export function useListingStore(): ListingStoreValue {
  const context = React.useContext(ListingStoreContext);
  if (!context) {
    throw new Error('useListingStore must be used within a ListingStoreProvider');
  }
  return context;
}
