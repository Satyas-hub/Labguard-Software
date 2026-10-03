package com.labguard.controller;

import com.labguard.dto.AnalyticsDtos.*;
import com.labguard.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/api/analytics/overview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminOverviewDto> getOverview() {
        return ResponseEntity.ok(analyticsService.getAdminOverview());
    }

    @GetMapping("/api/analytics/charts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AnalyticsChartsDto> getCharts() {
        return ResponseEntity.ok(analyticsService.getAnalyticsCharts());
    }
}
