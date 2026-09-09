using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

public class ResolveFailureTests
{
    [Theory]
    [InlineData(ResolveErrorCode.NotImplemented, "not-implemented")]
    [InlineData(ResolveErrorCode.ElevatedTarget, "elevated-target")]
    [InlineData(ResolveErrorCode.FocusMismatch, "focus-mismatch")]
    [InlineData(ResolveErrorCode.UiaTimeout, "uia-timeout")]
    [InlineData(ResolveErrorCode.NoAddressBar, "no-address-bar")]
    [InlineData(ResolveErrorCode.AddressBarFocused, "address-bar-focused")]
    public void WireMessageIsPrefixedWithAGreppableTag(ResolveErrorCode code, string expectedTag)
    {
        var failure = new ResolveFailure(code, "some human-readable detail");

        Assert.Equal($"[{expectedTag}] some human-readable detail", failure.ToWireMessage());
    }
}
