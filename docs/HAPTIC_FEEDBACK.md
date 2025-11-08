# Haptic Feedback Implementation Guide

## Overview

Haptic feedback (vibration) provides tactile confirmation to users, making the app feel more responsive and natural. This is especially valuable on mobile devices for transaction entry, form validation, and error handling.

## Browser & Device Support

### Supported Browsers
- **Chrome/Chromium:** 32+
- **Firefox:** 26+
- **Safari:** 13+ (iOS 13+)
- **Edge:** 15+
- **Opera:** 19+

### Supported Devices
- ✅ Most Android phones and tablets
- ✅ iPhones/iPads with iOS 13+
- ❌ Older devices without vibration hardware
- ❌ Desktop computers (no vibration)

### Graceful Degradation
The implementation gracefully handles unsupported devices by:
1. Checking for vibration API support at runtime
2. Silently skipping haptic feedback if unavailable
3. Never blocking user actions due to missing haptic support

## Implementation

### Hook: `useHapticFeedback`

Located at: `hooks/useHapticFeedback.ts`

**Basic Usage:**
```typescript
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

function MyComponent() {
  const { triggerSuccess, triggerError, isSupported } = useHapticFeedback();

  return (
    <button onClick={() => triggerSuccess()}>
      Create
    </button>
  );
}
```

**Advanced Usage:**
```typescript
const { trigger } = useHapticFeedback();

// Trigger with custom pattern
trigger('success');           // Success pattern: [20, 10, 30, 10, 20]
trigger('error');             // Error pattern: [100, 100, 100]
trigger('warning');           // Warning pattern: [50, 50, 50, 50]
trigger('custom', {
  duration: 50,              // Custom duration (ms)
  intensity: 80,             // Custom intensity (0-100)
  repeat: 2                  // Repeat pattern N times
});
```

### Direct Function Usage

For one-off haptic feedback without React hooks:

```typescript
import { triggerHaptic, HapticFeedbackTypes } from '@/hooks/useHapticFeedback';

// Predefined patterns
HapticFeedbackTypes.transactionCreated();
HapticFeedbackTypes.validationError();
HapticFeedbackTypes.fieldComplete();

// Custom patterns
triggerHaptic('success');
triggerHaptic('custom', { duration: 100 });
```

## Haptic Patterns

### Pattern Reference

| Pattern | Duration | Use Cases | Intensity |
|---------|----------|-----------|-----------|
| **light** | 10ms | Field focus, selection | Subtle |
| **medium** | 30ms | Button press, form submit | Standard |
| **heavy** | 50ms | Important action, deletion | Strong |
| **success** | [20,10,30,10,20] | Form submission, creation | Celebratory |
| **error** | [100,100,100] | Validation errors, failures | Warning |
| **warning** | [50,50,50,50] | Cautions, duplicates detected | Alert |
| **selection** | [10,20] | List selection, focus change | Light-medium |

### Visual Pattern Breakdown

```
Success: [20,10,30,10,20]
╔════╗ ╔════════╗ ╔════╗
║tap ║ ║longer  ║ ║tap ║    Celebratory 3-part pattern
└────┘ └────────┘ └────┘

Error: [100,100,100]
╚══════════╝ ╚══════════╝ ╚══════════╝
 Triple vibration        Alert/warning

Warning: [50,50,50,50]
╚═════╝ ╚═════╝ ╚═════╝ ╚═════╝
  Double pulse pattern    Caution
```

## Integrated Haptic Feedback

### Transaction Form

**Location:** `components/transactions/transaction-form.tsx`

**Triggers:**
```typescript
// Successful transaction creation
onSuccess: () => {
  HapticFeedbackTypes.transactionCreated();  // Success pattern
}

// Transaction submission error
onError: () => {
  HapticFeedbackTypes.transactionError();    // Error pattern
}
```

### Potential Additional Integrations

These are optional integrations that could be added:

#### 1. Validation Feedback
```typescript
// When form field validation fails
const validateField = (value) => {
  if (!isValid(value)) {
    HapticFeedbackTypes.validationError();  // Error pattern
  }
}

// When field is successfully completed
const onFieldComplete = () => {
  HapticFeedbackTypes.fieldComplete();      // Selection pattern
}
```

#### 2. Duplicate Detection
```typescript
// When duplicate transaction detected
const onDuplicateDetected = () => {
  HapticFeedbackTypes.duplicateDetected();  // Warning pattern
}
```

#### 3. Button Actions
```typescript
// On any button press
<Button
  onClick={() => {
    HapticFeedbackTypes.buttonPress();      // Light tap
    handleAction();
  }}
/>

// On confirmations
const onConfirm = () => {
  HapticFeedbackTypes.buttonConfirm();      // Medium feedback
}
```

#### 4. Navigation
```typescript
// On navigation between screens
router.push('/dashboard');
HapticFeedbackTypes.navigationTap();        // Light feedback
```

## Haptic Pattern Recommendations

### For Each User Interaction Type

| Interaction | Pattern | Reason |
|-------------|---------|--------|
| Text field focus | `light` | Subtle, non-intrusive |
| Text field complete | `selection` | Indicates progress |
| Button press | `light` | Quick feedback |
| Successful action | `success` | Celebratory 3-part |
| Form submission | `medium` | Clear confirmation |
| Validation error | `error` | Triple alert |
| Warning/caution | `warning` | Double pulse alert |
| Deletion action | `heavy` | Strong confirmation |

## Technical Details

### Vibration API Spec

The Vibration API (`navigator.vibrate()`) accepts:
- **Single integer:** Duration in milliseconds (e.g., 100)
- **Array of integers:** Vibrate-pause-vibrate pattern (e.g., [50, 100, 50])
- **0:** Stops ongoing vibration

### Implementation Details

```typescript
// Type signature
navigator.vibrate(pattern: number | number[]): boolean

// Examples
navigator.vibrate(100);              // 100ms vibration
navigator.vibrate([100, 50, 100]);   // 100ms, pause 50ms, 100ms
navigator.vibrate(0);                // Stop vibration
```

### Performance Notes

- **CPU Impact:** Negligible (hardware-level operation)
- **Battery Impact:** Minimal (brief vibration only when triggered)
- **Latency:** < 1ms from call to physical feedback
- **No blocking:** Never blocks user input or navigation

## User Preferences & Accessibility

### Respecting System Settings

The implementation respects device-level haptic settings:
- **iOS:** Respects "Vibration" toggle in Settings → Sound & Haptics
- **Android:** Respects "Haptic Feedback" toggle in Settings

Users can disable haptics globally, and the app gracefully handles it.

### Accessibility Considerations

1. **Screen Readers:** Haptic feedback supplements but doesn't replace visual/audio feedback
2. **Deaf/Hard of Hearing:** Haptics are an additional sensory feedback, not sole notification method
3. **Motor Impairments:** Haptic feedback helps confirm actions for users with limited motor control
4. **Battery-Saver Mode:** Some devices disable haptics in battery-saver mode (gracefully handled)

## Testing Haptic Feedback

### Manual Testing on Mobile Devices

1. **iPhone/iPad:**
   - Settings → Sound & Haptics → Haptic Strength (must be enabled)
   - Test in Safari or Chrome
   - Use DevTools remote debugging for detailed observation

2. **Android:**
   - Settings → Sound & Vibration → Vibration intensity
   - Test in Chrome or Firefox
   - Use device vibration settings to adjust intensity

3. **Desktop (Chrome DevTools):**
   - Can simulate (limited usefulness without actual hardware)
   - Open DevTools → More tools → WebAuthn
   - Note: Desktop simulation is development-only

### Automated Testing

```typescript
// Jest test example
import { triggerHaptic } from '@/hooks/useHapticFeedback';

test('triggers haptic feedback on form success', () => {
  const vibrateSpy = jest.spyOn(navigator, 'vibrate');

  triggerHaptic('success');

  expect(vibrateSpy).toHaveBeenCalledWith([20, 10, 30, 10, 20]);
});
```

### Debug Checklist

- [ ] Device supports vibration (Android or iOS 13+)
- [ ] System haptics are enabled in device settings
- [ ] Battery saver mode is OFF (may disable haptics)
- [ ] Browser supports Vibration API
- [ ] Hook is imported correctly
- [ ] `triggerHaptic()` called without errors
- [ ] Device vibrates when expected
- [ ] Pattern duration matches expected milliseconds

## Troubleshooting

### Issue: No vibration feedback
**Solutions:**
1. Check device settings - haptics might be disabled
2. Check browser support (use older devices/browsers?)
3. Verify `isSupported` flag returns true
4. Increase pattern duration (some devices require minimum 10-20ms)
5. Check if in battery-saver mode (disable temporarily)

### Issue: Vibration too subtle
**Solutions:**
1. Increase duration: `trigger('custom', { duration: 100 })`
2. Increase intensity: `trigger('custom', { intensity: 100 })`
3. Use heavier pattern: `trigger('heavy')` instead of `trigger('light')`
4. Check device vibration settings (may be set too low)

### Issue: Vibration too strong
**Solutions:**
1. Decrease intensity: `trigger('custom', { intensity: 50 })`
2. Use lighter pattern: `trigger('light')` instead of `trigger('heavy')`
3. Reduce duration: `trigger('custom', { duration: 20 })`

### Issue: Vibration causes app lag
**Solutions:**
1. Pattern durations are in milliseconds and run on hardware thread (shouldn't lag)
2. If lag occurs, likely due to other rendering/computation
3. Profile with DevTools to identify actual bottleneck

## Best Practices

### Do's ✅
- Use haptics to confirm successful actions
- Use consistent patterns for same action types
- Test on actual devices (not just desktop)
- Respect system-level haptic settings
- Provide visual feedback in addition to haptics
- Use lighter patterns for frequent interactions
- Stop vibration when action is interrupted

### Don'ts ❌
- Don't rely solely on haptics (visual feedback needed)
- Don't use constant vibration (battery drain + annoying)
- Don't use very long patterns (> 500ms)
- Don't overuse heavy patterns (save for important actions)
- Don't vibrate on every keystroke (excessive)
- Don't ignore browser support checks

## Future Enhancements

### Phase 1: Advanced Patterns (Planned)
- Custom pattern builder UI
- User-defined haptic preferences
- Haptic intensity settings (low/medium/high)
- Toggle individual haptic types on/off

### Phase 2: Advanced Features (Consider)
- Haptic sequences for multi-step workflows
- Progressive haptics for loading/progress
- Rhythm-based patterns for animations
- Haptic notifications for background events

### Phase 3: Integration (Future)
- Haptic feedback for gesture recognition
- Haptic notifications from background sync
- Haptic feedback for voice input confirmation
- Advanced audio-haptic synchronization

## References

### Official Documentation
- [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [W3C Vibration Specification](https://w3c.github.io/vibration/)
- [Can I Use - Vibration API](https://caniuse.com/vibration)

### iOS Haptics
- [UIFeedbackGenerator (iOS)](https://developer.apple.com/documentation/uikit/uifeedbackgenerator)
- [Apple Design Guidelines - Haptics](https://developer.apple.com/design/human-interface-guidelines/ios/user-interaction/haptics/)

### Android Vibration
- [Android Vibrator Service](https://developer.android.com/reference/android/os/Vibrator)
- [Material Design - Haptic Patterns](https://material.io/design/platform-guidance/android-bars.html)

### Research & Articles
- [UX Impact of Haptic Feedback](https://www.nngroup.com/articles/haptic-feedback/)
- [Haptic Design Patterns](https://hapticdesign.com/)
