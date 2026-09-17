using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

public class AddressBarSelectorTests
{
    [Fact]
    public void PicksTheFirstNonFocusedEditWithAValidHost()
    {
        var candidates = new[]
        {
            new AddressBarCandidate("some toolbar button", HasKeyboardFocus: false, IsEdit: false),
            new AddressBarCandidate("example.com/a", HasKeyboardFocus: false, IsEdit: true),
        };

        Assert.Equal("example.com/a", AddressBarSelector.SelectGenericFallback(candidates));
    }

    [Fact]
    public void RejectsAnEditThatHasKeyboardFocusEvenIfItsValueLooksLikeAHost()
    {
        // Step 14: "this one check eliminates most half-typed-search-query
        // garbage" — even a currently-valid-looking value must be rejected
        // while the user is actively typing into the field.
        var candidates = new[]
        {
            new AddressBarCandidate("example.com/a", HasKeyboardFocus: true, IsEdit: true),
        };

        Assert.Null(AddressBarSelector.SelectGenericFallback(candidates));
    }

    [Fact]
    public void SkipsAFocusedEditAndFallsThroughToALaterUnfocusedOne()
    {
        var candidates = new[]
        {
            new AddressBarCandidate("half typed search", HasKeyboardFocus: true, IsEdit: true),
            new AddressBarCandidate("example.com/a", HasKeyboardFocus: false, IsEdit: true),
        };

        Assert.Equal("example.com/a", AddressBarSelector.SelectGenericFallback(candidates));
    }

    [Fact]
    public void SkipsNonEditElementsRegardlessOfTheirValue()
    {
        var candidates = new[]
        {
            new AddressBarCandidate("example.com/a", HasKeyboardFocus: false, IsEdit: false),
        };

        Assert.Null(AddressBarSelector.SelectGenericFallback(candidates));
    }

    [Fact]
    public void ReturnsNullWhenNoCandidateNormalizesToAValidHost()
    {
        var candidates = new[]
        {
            new AddressBarCandidate("how do I center a div", HasKeyboardFocus: false, IsEdit: true),
        };

        Assert.Null(AddressBarSelector.SelectGenericFallback(candidates));
    }

    [Fact]
    public void ReturnsNullForAnEmptyCandidateList()
    {
        Assert.Null(AddressBarSelector.SelectGenericFallback(Array.Empty<AddressBarCandidate>()));
    }
}
