package com.labguard.repository;

import com.labguard.entity.Computer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ComputerRepository extends JpaRepository<Computer, UUID> {
    List<Computer> findByLabId(UUID labId);
    Optional<Computer> findByLabIdAndPcCode(UUID labId, String pcCode);

    @Query("SELECT c FROM Computer c WHERE c.lab.code = :labCode AND c.pcCode = :pcCode")
    Optional<Computer> findByLabCodeAndPcCode(@Param("labCode") String labCode, @Param("pcCode") String pcCode);

    long countByLabIdAndStatus(UUID labId, String status);
    long countByLabIdAndIsOnline(UUID labId, Boolean isOnline);
}
