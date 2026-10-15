import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, KPIStat, Badge, EmptyState } from '@/components';

function wrap(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );
}

describe('UI kit', () => {
  it('renders a Button and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = wrap(<Button title="Save" onPress={onPress} />);
    fireEvent.press(getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = wrap(<Button title="Save" onPress={onPress} disabled />);
    fireEvent.press(getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders a KPIStat with label, value and sublabel', () => {
    const { getByText } = wrap(<KPIStat label="Revenue" value="₹1.2L" sublabel="Today" />);
    expect(getByText('Revenue')).toBeTruthy();
    expect(getByText('₹1.2L')).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
  });

  it('renders a Badge', () => {
    const { getByText } = wrap(<Badge label="Owner" tone="primary" />);
    expect(getByText('Owner')).toBeTruthy();
  });

  it('renders EmptyState with an action that fires', () => {
    const onAction = jest.fn();
    const { getByText } = wrap(
      <EmptyState title="Nothing here" actionLabel="Add" onAction={onAction} />
    );
    expect(getByText('Nothing here')).toBeTruthy();
    fireEvent.press(getByText('Add'));
    expect(onAction).toHaveBeenCalled();
  });
});
