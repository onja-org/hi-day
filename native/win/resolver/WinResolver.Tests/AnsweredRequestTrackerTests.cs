using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

public class AnsweredRequestTrackerTests
{
    [Fact]
    public void FirstClaimForAnIdSucceeds()
    {
        var tracker = new AnsweredRequestTracker();

        Assert.True(tracker.TryClaim(1));
    }

    [Fact]
    public void SecondClaimForTheSameIdFails()
    {
        // This is the actual timeout-vs-real-result race: whichever side
        // claims first wins, and the loser must know it lost.
        var tracker = new AnsweredRequestTracker();
        tracker.TryClaim(1);

        Assert.False(tracker.TryClaim(1));
    }

    [Fact]
    public void DifferentIdsDoNotInterfereWithEachOther()
    {
        var tracker = new AnsweredRequestTracker();

        Assert.True(tracker.TryClaim(1));
        Assert.True(tracker.TryClaim(2));
    }

    [Fact]
    public void ForgettingAnIdAllowsItToBeClaimedAgain()
    {
        var tracker = new AnsweredRequestTracker();
        tracker.TryClaim(1);

        tracker.Forget(1);

        Assert.True(tracker.TryClaim(1));
    }
}
